import { render, screen } from "@testing-library/react";
import { ReceiptUploader } from "./receipt-uploader";

describe("ReceiptUploader", () => {
  it("renders upload prompt", () => {
    render(
      <ReceiptUploader
        onReceiptParsed={() => {}}
        isLoading={false}
        setIsLoading={() => {}}
        resetImageTrigger={0}
      />
    );
    expect(screen.getByText(/upload your receipt/i)).toBeInTheDocument();
  });
});
