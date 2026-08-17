import { test, expect, type Page } from "@playwright/test";
import { preloadSession, baseState, emptyPerson } from "./helpers";

const THREE_PEOPLE = [
  emptyPerson("p1", "Alice"),
  emptyPerson("p2", "Bob"),
  emptyPerson("p3", "Charlie"),
];

const DINNER_CREW = {
  id: "g1",
  name: "Dinner Crew",
  emoji: "🍕",
  memberIds: ["p1", "p2"],
};

function peopleTabState(overrides: Record<string, unknown> = {}) {
  return baseState({
    people: THREE_PEOPLE,
    groups: [DINNER_CREW],
    ...overrides,
  });
}

async function openPeopleTab(
  page: Page,
  state: Record<string, unknown> = peopleTabState(),
) {
  await preloadSession(page, state, "people");
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: /create group/i }).first(),
  ).toBeVisible({ timeout: 10000 });
}

function groupCard(page: Page, name: string) {
  return page
    .locator("div.rounded-lg")
    .filter({ hasText: name })
    .filter({ hasText: "Members:" });
}

async function openCreateDialog(page: Page) {
  await page.getByRole("button", { name: /create group/i }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Create New Group")).toBeVisible();
  return dialog;
}

async function openEditDialog(page: Page, groupName: string) {
  await page.getByRole("button", { name: `Edit ${groupName}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Edit Group")).toBeVisible();
  return dialog;
}

test.describe("group management", () => {
  test("creates a group with an emoji and member list", async ({ page }) => {
    await openPeopleTab(
      page,
      baseState({ people: THREE_PEOPLE, groups: [] }),
    );

    const dialog = await openCreateDialog(page);
    await dialog.getByLabel("Group Name").fill("Dinner Crew");
    await dialog.getByLabel("Alice", { exact: true }).click();
    await dialog.getByLabel("Bob", { exact: true }).click();
    await dialog.getByRole("button", { name: "Create Group" }).click();

    await expect(page.getByText('Group "Dinner Crew" created!')).toBeVisible();
    const card = groupCard(page, "Dinner Crew");
    await expect(card).toBeVisible();
    await expect(card.getByText("Members: Alice, Bob")).toBeVisible();
    await expect(card.locator("span.text-lg")).not.toHaveText("");
  });

  test("duplicate group name shows an error and does not create a second group", async ({
    page,
  }) => {
    await openPeopleTab(page);

    const dialog = await openCreateDialog(page);
    await dialog.getByLabel("Group Name").fill("Dinner Crew");
    await dialog.getByLabel("Alice", { exact: true }).click();
    await dialog.getByLabel("Bob", { exact: true }).click();
    await dialog.getByRole("button", { name: "Create Group" }).click();

    await expect(
      page.getByText("A group with that name already exists"),
    ).toBeVisible();
    await expect(page.getByText("Dinner Crew")).toHaveCount(1);
  });

  test("editing a group name persists", async ({ page }) => {
    await openPeopleTab(page);

    const dialog = await openEditDialog(page, "Dinner Crew");
    await dialog.getByLabel("Group Name").fill("Brunch Crew");
    await dialog.getByRole("button", { name: "Update Group" }).click();

    await expect(page.getByText('Group "Brunch Crew" updated!')).toBeVisible();
    await expect(groupCard(page, "Brunch Crew")).toBeVisible();
    await expect(page.getByText("Dinner Crew")).toHaveCount(0);
  });

  test("deleting a group removes it from the list", async ({ page }) => {
    await openPeopleTab(page);

    await page.getByRole("button", { name: "Delete Dinner Crew" }).click();

    await expect(page.getByText('Group "Dinner Crew" deleted')).toBeVisible();
    await expect(page.getByText("Dinner Crew")).toHaveCount(0);
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
    await openPeopleTab(
      page,
      peopleTabState({
        groups: [
          { ...DINNER_CREW, memberIds: ["p1", "p2", "p3"] },
        ],
      }),
    );

    const dialog = await openEditDialog(page, "Dinner Crew");
    await dialog.getByLabel("Charlie", { exact: true }).click();
    await dialog.getByRole("button", { name: "Update Group" }).click();

    await expect(
      groupCard(page, "Dinner Crew").getByText("Members: Alice, Bob"),
    ).toBeVisible();
    await expect(
      groupCard(page, "Dinner Crew").getByText("Charlie"),
    ).toHaveCount(0);
  });

  test("regenerating emoji replaces the previous emoji", async ({ page }) => {
    await openPeopleTab(page);

    const card = groupCard(page, "Dinner Crew");
    const emoji = card.locator("span.text-lg");
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
    await openPeopleTab(
      page,
      peopleTabState({
        assignedItems: [
          [
            0,
            [
              { personId: "p1", sharePercentage: 50 },
              { personId: "p2", sharePercentage: 50 },
            ],
          ],
        ],
        unassignedItems: [1],
      }),
    );

    await page.getByRole("button", { name: "Delete Dinner Crew" }).click();
    await expect(page.getByText("Dinner Crew")).toHaveCount(0);

    await page.getByRole("tab", { name: /assign items/i }).click();
    const burgerRow = page.getByRole("row").filter({ hasText: "Burger" });
    await expect(burgerRow).toBeVisible({ timeout: 10000 });
    await expect(burgerRow).toContainText("Alice");
    await expect(burgerRow).toContainText("Bob");
    await expect(burgerRow).not.toContainText("Unknown");
    await expect(burgerRow).not.toContainText("Unassigned");

    await burgerRow.getByRole("button").filter({ hasText: "Alice" }).click();
    const popover = page.getByRole("dialog").or(page.locator("[data-radix-popper-content-wrapper]"));
    await expect(popover.getByText("Dinner Crew")).toHaveCount(0);
  });
});
