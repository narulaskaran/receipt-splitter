import { test, expect, type Locator, type Page } from "@playwright/test";
import { preloadSession, baseState, emptyPerson } from "./helpers";

const DINNER_CREW = {
  id: "g1",
  name: "Dinner Crew",
  emoji: "🍕",
  memberIds: ["p1", "p2"],
};

function peopleTabState(overrides: Record<string, unknown> = {}) {
  return baseState({
    people: [
      emptyPerson("p1", "Alice"),
      emptyPerson("p2", "Bob"),
      emptyPerson("p3", "Charlie"),
    ],
    groups: [DINNER_CREW],
    ...overrides,
  });
}

async function openPeopleTab(
  page: Page,
  overrides: Record<string, unknown> = {},
) {
  await preloadSession(page, peopleTabState(overrides), "people");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /create group/i }).first(),
  ).toBeVisible({ timeout: 10000 });
}

function groupCard(page: Page, name: string) {
  return page
    .locator("div")
    .filter({ has: page.getByRole("button", { name: `Edit ${name}` }) })
    .filter({ hasText: "Members:" })
    .last();
}

async function openCreateDialog(page: Page) {
  await page.getByRole("button", { name: /create group/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Create New Group")).toBeVisible();
  return dialog;
}

async function submitCreateGroup(
  dialog: Locator,
  name: string,
  members: string[],
) {
  await dialog.getByLabel("Group Name").fill(name);
  for (const member of members) {
    await dialog.getByLabel(member, { exact: true }).click();
  }
  await dialog.getByRole("button", { name: "Create Group" }).click();
}

async function openEditDialog(page: Page, groupName: string) {
  await page.getByRole("button", { name: `Edit ${groupName}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Edit Group")).toBeVisible();
  return dialog;
}

test.describe("group management", () => {
  test("creates a group with an emoji and member list", async ({ page }) => {
    await openPeopleTab(page, { groups: [] });

    await submitCreateGroup(await openCreateDialog(page), "Dinner Crew", [
      "Alice",
      "Bob",
    ]);

    await expect(page.getByText('Group "Dinner Crew" created!')).toBeVisible();
    const card = groupCard(page, "Dinner Crew");
    await expect(card).toBeVisible();
    await expect(card.getByText("Members: Alice, Bob")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Change emoji for Dinner Crew" }),
    ).toBeVisible();
  });

  test("duplicate group name shows an error and does not create a second group", async ({
    page,
  }) => {
    await openPeopleTab(page);

    const dialog = await openCreateDialog(page);
    await submitCreateGroup(dialog, "Dinner Crew", ["Alice", "Bob"]);

    await expect(
      page.getByText("A group with that name already exists"),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("button", { name: "Edit Dinner Crew" }),
    ).toHaveCount(1);
  });

  test("editing a group name persists", async ({ page }) => {
    await openPeopleTab(page);

    const dialog = await openEditDialog(page, "Dinner Crew");
    await dialog.getByLabel("Group Name").fill("Brunch Crew");
    await dialog.getByRole("button", { name: "Update Group" }).click();

    await expect(page.getByText('Group "Brunch Crew" updated!')).toBeVisible();
    await expect(groupCard(page, "Brunch Crew")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit Dinner Crew" }),
    ).toHaveCount(0);
  });

  test("deleting a group removes it from the list", async ({ page }) => {
    await openPeopleTab(page);

    await page.getByRole("button", { name: "Delete Dinner Crew" }).click();

    await expect(page.getByText('Group "Dinner Crew" deleted')).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit Dinner Crew" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Create groups to quickly assign items to multiple people"),
    ).toBeVisible();
  });

  test("adding a person to a group updates the members list", async ({
    page,
  }) => {
    await openPeopleTab(page);

    const dialog = await openEditDialog(page, "Dinner Crew");
    await dialog.getByLabel("Charlie", { exact: true }).click();
    await dialog.getByRole("button", { name: "Update Group" }).click();

    await expect(
      groupCard(page, "Dinner Crew").getByText("Members: Alice, Bob, Charlie"),
    ).toBeVisible();
  });

  test("removing a person from a group updates the members list", async ({
    page,
  }) => {
    await openPeopleTab(page, {
      groups: [{ ...DINNER_CREW, memberIds: ["p1", "p2", "p3"] }],
    });

    const dialog = await openEditDialog(page, "Dinner Crew");
    await dialog.getByLabel("Charlie", { exact: true }).click();
    await dialog.getByRole("button", { name: "Update Group" }).click();

    const card = groupCard(page, "Dinner Crew");
    await expect(card.getByText("Members: Alice, Bob")).toBeVisible();
    await expect(card.getByText("Charlie")).toHaveCount(0);
  });

  test("regenerating emoji replaces the previous emoji", async ({ page }) => {
    await openPeopleTab(page);

    const emoji = groupCard(page, "Dinner Crew").locator("span").first();
    const before = (await emoji.textContent()) ?? "";
    expect(before.length).toBeGreaterThan(0);

    await page
      .getByRole("button", { name: "Change emoji for Dinner Crew" })
      .click();

    await expect(emoji).not.toHaveText(before);
  });

  test("deleting a group with assigned items does not orphan those assignments", async ({
    page,
  }) => {
    await openPeopleTab(page, {
      assignedItems: [
        [
          0,
          [
            { personId: "p1", sharePercentage: 50 },
            { personId: "p2", sharePercentage: 50 },
          ],
        ],
      ],
    });

    await page.getByRole("button", { name: "Delete Dinner Crew" }).click();
    await expect(
      page.getByRole("button", { name: "Edit Dinner Crew" }),
    ).toHaveCount(0);

    await page.getByRole("tab", { name: /assign items/i }).click();
    const burgerRow = page.getByRole("row").filter({ hasText: "Burger" });
    await expect(burgerRow).toBeVisible({ timeout: 10000 });
    await expect(burgerRow).toContainText("Alice");
    await expect(burgerRow).toContainText("Bob");

    await burgerRow.getByRole("button").filter({ hasText: "Alice" }).click();
    await expect(page.getByText("Groups")).toHaveCount(0);
  });
});
