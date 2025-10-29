# Deployment Checklist - Before Using at Work

## Security Setup (CRITICAL)

- [ ] **Change Admin Password**
  - Edit `config.json`
  - Replace `"password": "changeme123"` with a strong password
  - Restart server after changing

- [ ] **Generate Random JWT Secret**
  - Edit `config.json`
  - Replace `"jwtSecret": "CHANGE_THIS_TO_RANDOM_STRING"` with a long random string
  - Example: Use a password generator to create a 32+ character string
  - Restart server after changing

- [ ] **Review Admin Username**
  - Change `"username": "admin"` to something less obvious if desired

## Network Configuration

- [ ] **Test Port Availability**
  - Default port is 3000
  - Change in `config.json` if needed (e.g., to 8080, 3001, etc.)
  - Ensure the port is not blocked by your work network

- [ ] **Find Your IP Address**
  - Windows: Run `ipconfig` in Command Prompt
  - Look for "IPv4 Address" (e.g., 192.168.1.100)
  - This is what you'll share with coworkers

- [ ] **Test Firewall Rules**
  - Windows Firewall may block incoming connections
  - Create an inbound rule for the port if needed
  - Or temporarily disable firewall to test

- [ ] **Verify Network Access**
  - Make sure your computer and coworkers are on the same network
  - Test by having someone open `http://YOUR_IP:3000` on their device

## Pre-Launch Testing

- [ ] **Create Test Account**
  1. Go to http://localhost:3000
  2. Register a test user
  3. Login and verify it works
  4. Test profile editing (colors, nickname)

- [ ] **Test Admin Panel**
  1. Go to http://localhost:3000/admin.html
  2. Login with admin credentials
  3. Verify you can see user list
  4. Test game switching

- [ ] **Test Example Games**
  - Play the number guessing game
  - Verify stats are saved
  - Check leaderboard appears
  - Open multiplayer drawing on two browsers
  - Verify real-time drawing works

- [ ] **Test from Another Device**
  - Use phone or another computer
  - Connect to http://YOUR_IP:3000
  - Ensure everything works remotely

## Optional Enhancements

- [ ] **Customize Server Settings**
  - Session expiry days (default: 30)
  - Max file upload size (default: 5MB)
  - Active game to load by default

- [ ] **Add Custom Games**
  - Create your own game in `games/` folder
  - Add game.json with metadata
  - Test game loading and API access

- [ ] **Create Admin Shortcuts**
  - Create a desktop shortcut to admin panel
  - Bookmark the admin URL for easy access

## Launch Day Checklist

- [ ] **Start Server**
  ```bash
  npm start
  ```
  - Verify server starts without errors
  - Note the port number shown

- [ ] **Share Access Information**
  - Give coworkers: `http://YOUR_IP:PORT`
  - Example: `http://192.168.1.100:3000`
  - Tell them to register their own accounts

- [ ] **Monitor First Users**
  - Watch admin panel for new registrations
  - Check for any error messages in terminal
  - Help first users get set up

- [ ] **Announce Features**
  - Tell users they can customize their profile colors
  - Explain how to access different games
  - Share any rules or guidelines

## Maintenance Tasks

- [ ] **Regular Backups**
  - Back up `data/gamehost.db` periodically
  - Back up `config.json`
  - Back up custom games in `games/` folder

- [ ] **Monitor Server**
  - Check terminal for errors
  - Monitor database size
  - Watch for suspicious activity in admin panel

- [ ] **Update Games**
  - Use admin panel to switch between games
  - Add new games as needed
  - Remove inactive games from `games/` folder

## Troubleshooting Reference

| Issue | Solution |
|-------|----------|
| Port already in use | Change port in config.json |
| Can't connect from other devices | Check firewall, ensure host is "0.0.0.0" |
| Forgot admin password | Edit config.json and restart server |
| Database corrupted | Delete data/gamehost.db (loses all data) |
| Games not loading | Check browser console, verify user is logged in |
| Stats not saving | Check server terminal for errors |

## Quick Commands

Start server:
```bash
npm start
```

Find your IP (Windows):
```bash
ipconfig
```

Check if port is in use (Windows):
```bash
netstat -an | findstr :3000
```

## Support Files

- **README.md** - Full documentation with API reference
- **QUICKSTART.md** - 5-minute setup guide
- **PROJECT_SUMMARY.md** - Overview of what was built

---

## Status Check

**Current Status**: ✓ Server is running on port 3000

**Ready for deployment**: Complete checklist above before sharing with coworkers

**Estimated setup time**: 10-15 minutes for security and network configuration
