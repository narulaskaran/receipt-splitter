// Provider-agnostic receipt parsing prompt. The output shape must stay in sync
// with receiptJsonSchema in src/lib/receipt-schema.ts.
export const RECEIPT_PROMPT = `Parse this receipt and return a JSON object with the following structure:
              {
                "restaurant": "Name of the restaurant or store",
                "date": "Date of purchase in YYYY-MM-DD format",
                "total": "Total amount as number",
                "subtotal": "Subtotal amount as number",
                "tax": "Tax amount as number",
                "tip": "Tip amount as number (if included)",
                "fees": "Sum of any surcharges or service fees as number (e.g. credit card surcharge, service charge, delivery fee), or null if none",
                "currency": "ISO 4217 currency code (e.g., USD, EUR, GBP, JPY, CAD, AUD, etc.)",
                "items": [
                  {
                    "name": "Item name",
                    "price": "Per-unit price as number (NEVER the line total — see instructions below)",
                    "quantity": "Quantity as number (default to 1 if not specified)"
                  }
                ]
              }
              \nInstructions:\n- Detect the currency and return the 3-letter ISO 4217 code (USD, EUR, GBP, JPY, CAD, AUD, INR, CNY, etc.). Use the following priority:\n  1. Explicit currency codes on the receipt (e.g., "USD", "EUR")\n  2. Country/region indicators (e.g., "USA" or US address → USD, "Japan" or Japanese text → JPY, "China" or Chinese characters → CNY)\n  3. Language context as a last resort\n- For ambiguous cases:\n  - If the receipt appears to be from Japan (Japanese text, Japan address, etc.) → use JPY\n  - If the receipt appears to be from China (Chinese characters, China address, etc.) → use CNY\n  - If the receipt appears to be from the USA → use USD\n  - If the receipt appears to be from Canada → use CAD\n  - If the receipt appears to be from Australia → use AUD\n- If the currency cannot be determined with confidence, default to 'USD'\n- Return ONLY the 3-letter ISO 4217 code (e.g., 'JPY'), not the currency symbol or full name\n- CRITICAL — Per-unit pricing for multi-quantity items:\n  - The 'price' field must ALWAYS be the price for ONE unit, never the line total.\n  - If the receipt shows a line total for multiple units, divide to get the per-unit price.\n  - Example: receipt line "7 Guinness Dft  $91.00" → output {"name": "Guinness Dft", "price": 13.00, "quantity": 7} because $91.00 ÷ 7 = $13.00 per drink.\n  - Example: receipt line "2 Club Soda  $16.00" → output {"name": "Club Soda", "price": 8.00, "quantity": 2} because $16.00 ÷ 2 = $8.00 each.\n  - Do NOT output the line total as the price — the application will multiply price × quantity automatically.\n- After extracting all items, verify: the sum of (price × quantity) for all items should approximately equal the subtotal. If it does not, re-examine any multi-quantity items to confirm you used the per-unit price and not the line total.\n- Surcharges and fees (credit card surcharge, service charge, delivery fee, etc.) are NOT items, tax, or tip. Add them together into 'fees'. Verify: subtotal + tax + fees + tip should equal total.\n- Only include items that were actually purchased AND have a visible price on the receipt.\n- SKIP item modifiers or add-ons (like "ADD CHEESE", "EXTRA SAUCE", etc.) that don't have their own price listed - these costs are included in the parent item's price.\n- If you can't determine any field, use null.\n- Keep the item names exactly as they appear on the receipt.\n- Return ONLY the JSON with no explanations or additional text.`;
