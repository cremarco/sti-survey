# GitHub Pages Deployment Guide

## Setup Instructions

### 1. Update Repository Settings

1. Go to your GitHub repository
2. Navigate to **Settings** > **Pages**
3. Under **Source**, select **GitHub Actions**

### 2. Update Homepage URL

In `package.json`, replace `[your-username]` with your actual GitHub username:

```json
"homepage": "https://your-actual-username.github.io/sti-survery"
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Manual Deployment (Optional)

If you want to deploy manually:

```bash
npm run deploy
```

### 5. Automatic Deployment

The GitHub Actions workflow will automatically deploy your app when you push to the `main` branch.

## Important Notes

- The app will be available at: `https://your-username.github.io/sti-survery`
- Make sure your repository is public or you have GitHub Pro for private repositories
- The first deployment might take a few minutes to become available
- Check the **Actions** tab in your repository to monitor deployment status

## Troubleshooting

- If the deployment fails, check the GitHub Actions logs
- Ensure all dependencies are properly listed in `package.json`
- Verify that the repository name in the homepage URL matches exactly 