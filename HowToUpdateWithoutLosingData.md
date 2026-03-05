# Updating Project Without Losing Data (Laptop B)

1. Your database is stored in the `data/` folder, which is not tracked by git.
2. When you update the project from GitHub:
   - Only the code in the `project/` folder and other tracked files will be updated.
   - The `data/database.db` file will remain untouched.
3. Your web app will continue to use the existing data automatically.
4. Always back up `data/database.db` before major updates, just in case.

**Summary:**
- Code and data are now separated.
- Updating code will not affect your data.
- You can safely add features and update the project without losing any records.
