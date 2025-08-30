#!/bin/bash

# Script to create all 8 stacked PRs for the receipt sharing feature
# Run this after: gh auth login

echo "🚀 Creating stacked PRs for receipt sharing feature..."
echo "📍 Current branch: $(git branch --show-current)"

# Verify we're authenticated
if ! gh auth status > /dev/null 2>&1; then
    echo "❌ Not authenticated with GitHub CLI. Run: gh auth login"
    exit 1
fi

# PR 1/8 - Data Serialization (current branch)
echo "📝 Creating PR 1/8: Data Serialization..."
gh pr create \
    --title "feat: [1/8] implement split data serialization and URL parameter structure" \
    --body-file pr_body.md \
    --base main \
    --head 08-30-feat_1_8_implement_split_data_serialization_and_url_parameter_structure

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 1/8"
    exit 1
fi

# Navigate to next branch and create PR 2/8
gt up
echo "📝 Creating PR 2/8: Validation & Error Handling..."
gh pr create \
    --title "feat: [2/8] add split data validation and error handling" \
    --body-file pr_body_2.md \
    --base main \
    --head 08-30-feat_2_8_add_split_data_validation_and_error_handling

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 2/8"
    exit 1
fi

# Navigate to next branch and create PR 3/8
gt up
echo "📝 Creating PR 3/8: Split Page Route..."
gh pr create \
    --title "feat: [3/8] create split page route with data retrieval" \
    --body-file pr_body_3.md \
    --base main \
    --head 08-30-feat_3_8_create_split_page_route_with_data_retrieval

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 3/8"
    exit 1
fi

# Navigate to next branch and create PR 4/8
gt up
echo "📝 Creating PR 4/8: Split Summary Display..."
gh pr create \
    --title "feat: [4/8] add split summary display component" \
    --body-file pr_body_4.md \
    --base main \
    --head 08-30-feat_4_8_add_split_summary_display_component

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 4/8"
    exit 1
fi

# Navigate to next branch and create PR 5/8
gt up
echo "📝 Creating PR 5/8: Payment Card Components..."
gh pr create \
    --title "feat: [5/8] add individual payment card components" \
    --body-file pr_body_5.md \
    --base main \
    --head 08-30-feat_5_8_add_individual_payment_card_components

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 5/8"
    exit 1
fi

# Navigate to next branch and create PR 6/8
gt up
echo "📝 Creating PR 6/8: Venmo Integration..."
gh pr create \
    --title "feat: [6/8] integrate Venmo payment functionality" \
    --body-file pr_body_6.md \
    --base main \
    --head 08-30-feat_6_8_integrate_venmo_payment_functionality

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 6/8"
    exit 1
fi

# Navigate to next branch and create PR 7/8
gt up
echo "📝 Creating PR 7/8: Share Button Integration..."
gh pr create \
    --title "feat: [7/8] add share split button to results summary" \
    --body-file pr_body_7.md \
    --base main \
    --head 08-30-feat_7_8_add_share_split_button_to_results_summary

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 7/8"
    exit 1
fi

# Navigate to final branch and create PR 8/8
gt up
echo "📝 Creating PR 8/8: Mobile Responsiveness & UX Polish..."
gh pr create \
    --title "feat: [8/8] add mobile responsiveness and UX polish" \
    --body-file pr_body_8.md \
    --base main \
    --head 08-30-feat_8_8_add_mobile_responsiveness_and_ux_polish

if [ $? -ne 0 ]; then
    echo "❌ Failed to create PR 8/8"
    exit 1
fi

echo "✅ Successfully created all 8 stacked PRs!"
echo ""
echo "📋 PR Summary:"
echo "1/8: Data Serialization & URL Parameter Structure"
echo "2/8: Split Data Validation & Error Handling"  
echo "3/8: Split Page Route & Data Retrieval"
echo "4/8: Split Summary Display Component"
echo "5/8: Individual Payment Card Components"
echo "6/8: Venmo Payment Integration"
echo "7/8: Share Button Integration"
echo "8/8: Mobile Responsiveness & UX Polish"
echo ""
echo "🔗 View all PRs: gh pr list"
echo "📊 View stack status: gt log"