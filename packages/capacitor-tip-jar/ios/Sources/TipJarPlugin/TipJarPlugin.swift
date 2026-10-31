import Capacitor
import Foundation
import StoreKit

// Written against the Capacitor 8 CAPPlugin / CAPBridgedPlugin pattern in
// node_modules/@capacitor/*/ios/Sources and StoreKit 2. Compiled with Xcode 27.1
// for the simulator; purchases still need the checklist in
// packages/capacitor-tip-jar/README.md.

/// Serializes `Product.purchase()` so two tips cannot be in flight together.
/// A lock plus unstructured tasks, not an actor: a `Task` created inside an
/// actor and then awaited deadlocks that actor. `Transaction.updates` does
/// not take this lock.
private final class PurchaseSerializer: @unchecked Sendable {
    private let lock = NSLock()
    private var tail: Task<Void, Never>?

    func run<T: Sendable>(_ operation: @escaping @Sendable () async -> T) async -> T {
        await enqueue(operation).value
    }

    /// Synchronous because `NSLock` is unavailable from async contexts.
    private func enqueue<T: Sendable>(_ operation: @escaping @Sendable () async -> T) -> Task<T, Never> {
        lock.lock()
        defer { lock.unlock() }
        let previous = tail
        let ticket = Task { () -> T in
            await previous?.value
            return await operation()
        }
        tail = Task { _ = await ticket.value }
        return ticket
    }
}

/// Holds the plugin weakly so the update listener does not retain it.
/// `TipJarPlugin` owns the listener task; a strong capture would cycle.
private final class WeakPlugin: @unchecked Sendable {
    weak var value: TipJarPlugin?
    init(_ value: TipJarPlugin) {
        self.value = value
    }
}

/// Finishes a verified consumable at most once. Purchases that already
/// resolved to the web layer are not announced again via `tipCompleted`.
/// Unverified transactions are left unfinished on purpose.
private actor TipTransactionCenter {
    private var finished: Set<UInt64> = []
    private var suppressNotify: Set<UInt64> = []

    func finishFromPurchase(_ transaction: Transaction) async {
        suppressNotify.insert(transaction.id)
        await finish(transaction)
    }

    /// Returns true when the listener should emit `tipCompleted` (a
    /// consumable that completed outside `purchase()`, such as Ask to Buy
    /// approved later). Already-finished and purchase-owned transactions
    /// return false.
    func finishFromUpdate(_ transaction: Transaction) async -> Bool {
        let shouldNotify = !finished.contains(transaction.id) && !suppressNotify.contains(transaction.id)
        await finish(transaction)
        return shouldNotify
    }

    func finishQuietly(_ transaction: Transaction) async {
        suppressNotify.insert(transaction.id)
        await finish(transaction)
    }

    private func finish(_ transaction: Transaction) async {
        if finished.contains(transaction.id) {
            return
        }
        finished.insert(transaction.id)
        await transaction.finish()
    }
}

private enum TipJarStore {
    static func loadProducts(ids: [String]) async throws -> [[String: String]] {
        if ids.isEmpty {
            return []
        }
        let found = try await Product.products(for: Set(ids))
        let byID = Dictionary(uniqueKeysWithValues: found.map { ($0.id, $0) })
        return ids.compactMap { id in
            guard let product = byID[id] else {
                return nil
            }
            return [
                "id": product.id,
                "displayName": product.displayName,
                "displayPrice": product.displayPrice
            ]
        }
    }

    static func purchase(id: String, transactions: TipTransactionCenter) async -> [String: String] {
        do {
            let found = try await Product.products(for: [id])
            guard let product = found.first else {
                return ["status": "failed", "message": "unknown product"]
            }
            // Consumable: nothing is stored as an entitlement. App Store
            // Connect must configure the id as a consumable; finishing is
            // what allows the same tip to be bought again.
            guard product.type == .consumable else {
                return ["status": "failed", "message": "not a consumable"]
            }
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                switch verification {
                case .verified(let transaction):
                    await transactions.finishFromPurchase(transaction)
                    return ["status": "success"]
                case .unverified:
                    // Do not finish. Acknowledging an unverified transaction
                    // would consume a tip we cannot trust.
                    return ["status": "failed", "message": "unverified"]
                }
            case .pending:
                return ["status": "pending"]
            case .userCancelled:
                return ["status": "cancelled"]
            @unknown default:
                return ["status": "failed", "message": "unknown purchase result"]
            }
        } catch {
            return ["status": "failed", "message": error.localizedDescription]
        }
    }
}

@objc(TipJarPlugin)
public class TipJarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TipJarPlugin"
    public let jsName = "TipJar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise)
    ]

    private let purchases = PurchaseSerializer()
    private let transactions = TipTransactionCenter()
    private var updatesTask: Task<Void, Never>?

    override public func load() {
        let transactions = self.transactions
        let plugin = WeakPlugin(self)
        updatesTask = Task {
            await withTaskGroup(of: Void.self) { group in
                group.addTask {
                    await Self.observeUpdates(transactions: transactions, plugin: plugin)
                }
                group.addTask {
                    await Self.observeUnfinished(transactions: transactions)
                }
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func getProducts(_ call: CAPPluginCall) {
        guard let ids = call.getArray("ids", String.self) else {
            call.reject("ids must be an array of strings")
            return
        }
        // Capacitor invokes plugin methods on the main thread. Hop off it for
        // StoreKit, then resolve back on the main actor.
        Task {
            do {
                let products = try await TipJarStore.loadProducts(ids: ids)
                await MainActor.run {
                    call.resolve(["products": products])
                }
            } catch {
                let message = error.localizedDescription
                await MainActor.run {
                    call.reject(message)
                }
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("Must provide a product id")
            return
        }
        let purchases = self.purchases
        let transactions = self.transactions
        Task {
            let payload = await purchases.run {
                await TipJarStore.purchase(id: id, transactions: transactions)
            }
            await MainActor.run {
                call.resolve(payload)
            }
        }
    }

    private static func observeUpdates(transactions: TipTransactionCenter, plugin: WeakPlugin) async {
        // Cancellation when the plugin is released ends this loop.
        for await update in Transaction.updates {
            guard case .verified(let transaction) = update else {
                continue
            }
            let shouldNotify = await transactions.finishFromUpdate(transaction)
            guard shouldNotify else {
                continue
            }
            let productID = transaction.productID
            await MainActor.run {
                plugin.value?.notifyListeners("tipCompleted", data: [
                    "id": productID,
                    "status": "success"
                ])
            }
        }
    }

    private static func observeUnfinished(transactions: TipTransactionCenter) async {
        for await update in Transaction.unfinished {
            guard case .verified(let transaction) = update else {
                continue
            }
            await transactions.finishQuietly(transaction)
        }
    }
}
