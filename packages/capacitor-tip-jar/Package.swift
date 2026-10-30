// swift-tools-version: 5.9
import PackageDescription

// UNCOMPILED. This package has not been built with Xcode, SwiftPM, or the
// Apple SDK. It follows the Capacitor 8 SPM layout used by the official
// plugins in node_modules (@capacitor/preferences and the others): product
// library name matches what `cap sync` derives from the npm package name
// (capacitor-tip-jar -> CapacitorTipJar), iOS 15 like those plugins, and
// capacitor-swift-pm pinned to the app's Capacitor version (8.6.0). The
// official plugins declare `from: "8.0.0"`; this local plugin pins exact
// 8.6.0 so it cannot resolve a different 8.x than ios/App/CapApp-SPM.
let package = Package(
    name: "CapacitorTipJar",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorTipJar",
            targets: ["TipJarPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.0")
    ],
    targets: [
        .target(
            name: "TipJarPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/TipJarPlugin")
    ]
)
