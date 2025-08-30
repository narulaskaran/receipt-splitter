# Manual PR Creation Commands

Run these commands in order after `gh auth login`:

## PR 1/8: Data Serialization
```bash
gt checkout 08-30-feat_1_8_implement_split_data_serialization_and_url_parameter_structure
gh pr create \
    --title "feat: [1/8] implement split data serialization and URL parameter structure" \
    --body-file pr_body.md \
    --base main
```

## PR 2/8: Validation & Error Handling  
```bash
gt checkout 08-30-feat_2_8_add_split_data_validation_and_error_handling
gh pr create \
    --title "feat: [2/8] add split data validation and error handling" \
    --body-file pr_body_2.md \
    --base main
```

## PR 3/8: Split Page Route
```bash
gt checkout 08-30-feat_3_8_create_split_page_route_with_data_retrieval
gh pr create \
    --title "feat: [3/8] create split page route with data retrieval" \
    --body-file pr_body_3.md \
    --base main
```

## PR 4/8: Split Summary Display
```bash
gt checkout 08-30-feat_4_8_add_split_summary_display_component
gh pr create \
    --title "feat: [4/8] add split summary display component" \
    --body-file pr_body_4.md \
    --base main
```

## PR 5/8: Payment Card Components
```bash
gt checkout 08-30-feat_5_8_add_individual_payment_card_components
gh pr create \
    --title "feat: [5/8] add individual payment card components" \
    --body-file pr_body_5.md \
    --base main
```

## PR 6/8: Venmo Integration
```bash
gt checkout 08-30-feat_6_8_integrate_venmo_payment_functionality
gh pr create \
    --title "feat: [6/8] integrate Venmo payment functionality" \
    --body-file pr_body_6.md \
    --base main
```

## PR 7/8: Share Button Integration
```bash
gt checkout 08-30-feat_7_8_add_share_split_button_to_results_summary
gh pr create \
    --title "feat: [7/8] add share split button to results summary" \
    --body-file pr_body_7.md \
    --base main
```

## PR 8/8: Mobile Responsiveness & UX Polish
```bash
gt checkout 08-30-feat_8_8_add_mobile_responsiveness_and_ux_polish
gh pr create \
    --title "feat: [8/8] add mobile responsiveness and UX polish" \
    --body-file pr_body_8.md \
    --base main
```

## Verify PRs Created
```bash
gh pr list
gt log
```