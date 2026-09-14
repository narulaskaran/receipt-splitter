import { render, screen } from "@testing-library/react";
import { ReceiptThumbnail } from "./receipt-thumbnail";

describe("ReceiptThumbnail", () => {
  describe("row", () => {
    it("renders the image when a src is provided", () => {
      render(
        <ReceiptThumbnail
          variant="row"
          src="data:image/jpeg;base64,thumb"
          alt="Cafe receipt preview"
        />
      );
      expect(screen.getByAltText("Cafe receipt preview")).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,thumb"
      );
    });

    it("renders a placeholder icon when src is missing", () => {
      render(
        <ReceiptThumbnail variant="row" alt="Cafe receipt preview" />
      );
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });

  describe("details", () => {
    it("renders the image when a src is provided", () => {
      render(
        <ReceiptThumbnail
          variant="details"
          src="data:image/jpeg;base64,thumb"
          alt="Cafe receipt image"
        />
      );
      expect(screen.getByAltText("Cafe receipt image")).toHaveAttribute(
        "src",
        "data:image/jpeg;base64,thumb"
      );
    });

    it("renders a placeholder when src is missing", () => {
      render(
        <ReceiptThumbnail variant="details" alt="Cafe receipt image" />
      );
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });
  });
});
