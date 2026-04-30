import { Mppx, tempo } from "mppx/server";

// Tempo pathUSD stablecoin on Allegro mainnet — override via MPP_CURRENCY_ADDRESS
const DEFAULT_CURRENCY = "0x20c0000000000000000000000000000000000000" as `0x${string}`;

function createMppx() {
  const recipient = process.env.MPP_RECIPIENT_ADDRESS;
  const currency = (process.env.MPP_CURRENCY_ADDRESS ?? DEFAULT_CURRENCY) as `0x${string}`;
  const secretKey = process.env.MPP_SECRET_KEY;

  if (!recipient || !secretKey) return null;

  return Mppx.create({
    methods: [tempo({ currency, recipient: recipient as `0x${string}` })],
    secretKey,
  });
}

// Lazily initialized so missing env vars return 503 instead of crashing at build time
let mppx: ReturnType<typeof createMppx> | undefined = undefined;

function getMppx() {
  if (mppx === undefined) mppx = createMppx();
  return mppx;
}

const TIP_AMOUNT = process.env.MPP_TIP_AMOUNT ?? "0.01";

export async function POST(request: Request) {
  const payment = getMppx();

  if (!payment) {
    return Response.json(
      {
        error: "MPP payments not configured",
        message:
          "Set MPP_RECIPIENT_ADDRESS and MPP_SECRET_KEY environment variables to enable AI agent tips.",
      },
      { status: 503 }
    );
  }

  const response = await payment.charge({
    amount: TIP_AMOUNT,
    description: "Tip for Receipt Splitter — thanks for the support!",
  })(request);

  if (response.status === 402) return response.challenge;

  return response.withReceipt(
    Response.json({
      message: "Thank you! Your tip supports ongoing development of Receipt Splitter.",
      project: "https://github.com/narulaskaran/receipt-splitter",
    })
  );
}

// GET returns endpoint metadata so agents can discover tip amount and currency
export async function GET() {
  const currency = process.env.MPP_CURRENCY_ADDRESS ?? DEFAULT_CURRENCY;
  const configured = Boolean(
    process.env.MPP_RECIPIENT_ADDRESS && process.env.MPP_SECRET_KEY
  );

  return Response.json({
    name: "Receipt Splitter Tip Jar",
    description:
      "Support Receipt Splitter development. Send a small tip via the Machine Payments Protocol.",
    endpoint: "/api/mpp/tip",
    method: "POST",
    amount: TIP_AMOUNT,
    currency,
    paymentMethods: ["tempo"],
    configured,
    mpp: "https://mpp.dev",
  });
}
