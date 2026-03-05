# How to View and Edit Your SQLite Database Independently

You can manage your database outside the web interface using a graphical tool. Here’s how to do it step by step:

## 1. Install DB Browser for SQLite
- Go to https://sqlitebrowser.org/
- Download the version for your operating system (Windows, macOS, Linux)
- Install the application

## 2. Open Your Database
- Launch DB Browser for SQLite
- Click `Open Database`
- Navigate to your project folder and select `database.db`

## 3. View and Edit Data
- Use the `Browse Data` tab to view tables and records
- To add, edit, or delete records:
  - Click on a table in the dropdown
  - Use the buttons at the bottom to add, edit, or delete rows
- Click `Write Changes` (or `Save`) to apply your edits

## 4. Use the Updated Data in Your Web App
- Your web app will automatically use the updated data the next time it runs or reloads

## 5. Best Practices
- Always back up `database.db` before making manual changes
- Avoid editing the database while the web app is actively writing to it

---

**Tip:** You can use any other SQLite GUI tool if you prefer, but DB Browser for SQLite is free and easy to use.
