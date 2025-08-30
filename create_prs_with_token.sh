#!/bin/bash

# Script to create all 8 stacked PRs using GITHUB_TOKEN environment variable
# Usage: GITHUB_TOKEN=your_token_here ./create_prs_with_token.sh

echo "🚀 Creating stacked PRs for receipt sharing feature..."

# Check for GitHub token (GitHub CLI supports both GH_TOKEN and GITHUB_TOKEN)
if [ -z "$GITHUB_TOKEN" ] && [ -z "$GH_TOKEN" ]; then
    echo "❌ GitHub token environment variable not set."
    echo ""
    echo "To create a GitHub token:"
    echo "1. Go to https://github.com/settings/tokens"
    echo "2. Click 'Generate new token (classic)'"
    echo "3. Select scopes: repo, workflow"
    echo "4. Copy the token"
    echo ""
    echo "Then run one of:"
    echo "GH_TOKEN=your_token_here ./create_prs_with_token.sh"
    echo "GITHUB_TOKEN=your_token_here ./create_prs_with_token.sh"
    echo ""
    echo "Or export it permanently:"
    echo "export GH_TOKEN=your_token_here"
    echo "./create_prs_with_token.sh"
    exit 1
fi

# Use whichever token is available
if [ -n "$GH_TOKEN" ]; then
    echo "✅ Using GH_TOKEN for authentication"
    export GITHUB_TOKEN="$GH_TOKEN"
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ Using GITHUB_TOKEN for authentication"
fi

# Verify GitHub CLI can use the token
echo "🔐 Testing GitHub CLI with token..."
if ! gh auth status > /dev/null 2>&1; then
    echo "✅ GitHub CLI will use GITHUB_TOKEN for authentication"
else
    echo "✅ GitHub CLI is already authenticated"
fi

# Get current branch to verify we're in the right place
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Starting from branch: $CURRENT_BRANCH"

# Start from the first branch in the stack
echo "🔄 Navigating to first branch..."
gt checkout 08-30-feat_1_8_implement_split_data_serialization_and_url_parameter_structure

# Function to create PR with error handling
create_pr() {
    local pr_number=$1
    local title=$2
    local body_file=$3
    local branch=$4
    
    echo "📝 Creating PR $pr_number..."
    
    if gh pr create \
        --title "$title" \
        --body-file "$body_file" \
        --base main \
        --head "$branch"; then
        echo "✅ Successfully created PR $pr_number"
        return 0
    else
        echo "❌ Failed to create PR $pr_number"
        return 1
    fi
}

# PR 1/8 - Data Serialization (current branch)
create_pr "1/8" \
    "feat: [1/8] implement split data serialization and URL parameter structure" \
    "pr_body.md" \
    "08-30-feat_1_8_implement_split_data_serialization_and_url_parameter_structure"

if [ $? -ne 0 ]; then exit 1; fi

# PR 2/8 - Validation & Error Handling
gt up
create_pr "2/8" \
    "feat: [2/8] add split data validation and error handling" \
    "pr_body_2.md" \
    "08-30-feat_2_8_add_split_data_validation_and_error_handling"

if [ $? -ne 0 ]; then exit 1; fi

# PR 3/8 - Split Page Route
gt up
create_pr "3/8" \
    "feat: [3/8] create split page route with data retrieval" \
    "pr_body_3.md" \
    "08-30-feat_3_8_create_split_page_route_with_data_retrieval"

if [ $? -ne 0 ]; then exit 1; fi

# PR 4/8 - Split Summary Display
gt up
create_pr "4/8" \
    "feat: [4/8] add split summary display component" \
    "pr_body_4.md" \
    "08-30-feat_4_8_add_split_summary_display_component"

if [ $? -ne 0 ]; then exit 1; fi

# PR 5/8 - Payment Card Components
gt up
create_pr "5/8" \
    "feat: [5/8] add individual payment card components" \
    "pr_body_5.md" \
    "08-30-feat_5_8_add_individual_payment_card_components"

if [ $? -ne 0 ]; then exit 1; fi

# PR 6/8 - Venmo Integration
gt up
create_pr "6/8" \
    "feat: [6/8] integrate Venmo payment functionality" \
    "pr_body_6.md" \
    "08-30-feat_6_8_integrate_venmo_payment_functionality"

if [ $? -ne 0 ]; then exit 1; fi

# PR 7/8 - Share Button Integration
gt up
create_pr "7/8" \
    "feat: [7/8] add share split button to results summary" \
    "pr_body_7.md" \
    "08-30-feat_7_8_add_share_split_button_to_results_summary"

if [ $? -ne 0 ]; then exit 1; fi

# PR 8/8 - Mobile Responsiveness & UX Polish
gt up
create_pr "8/8" \
    "feat: [8/8] add mobile responsiveness and UX polish" \
    "pr_body_8.md" \
    "08-30-feat_8_8_add_mobile_responsiveness_and_ux_polish"

if [ $? -ne 0 ]; then exit 1; fi

echo ""
echo "🎉 Successfully created all 8 stacked PRs!"
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
echo ""
echo "🎯 Next Steps:"
echo "- PRs can be reviewed independently"
echo "- Merge in order as they're approved"
echo "- Each PR builds on the previous one"
echo "- Feature will be complete when all PRs are merged"