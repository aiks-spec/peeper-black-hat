# 🚀 OSINT Lookup Engine - Deployment Guide

## 📋 **Pre-Deployment Checklist**

### ✅ **Database Reset**
- Visitor count: **RESET TO 0** ✅
- Search count: **RESET TO 0** ✅
- All temporary files will be cleaned up automatically ✅

### ✅ **File Cleanup System**
- **Automatic cleanup**: All generated files (JSON, CSV) are deleted after 30 minutes
- **Server shutdown cleanup**: All temporary files are removed when server stops
- **No local file dependencies**: All paths are cross-platform compatible

### ✅ **Production Optimizations**
- **Reduced logging**: Detailed debug logs are disabled in production
- **Cross-platform support**: Works on Windows, Linux, and Mac
- **Environment-based configuration**: Separate dev/prod settings

## 🌐 **Deployment Options**

### **Option 1: Heroku**
```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create app
heroku create your-osint-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set CUFINDER_API_KEY=your_key_here

# Deploy
git push heroku main
```

### **Option 2: Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### **Option 3: DigitalOcean App Platform**
- Connect your GitHub repository
- Set environment variables in the dashboard
- Deploy automatically on push

### **Option 4: Vercel**
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## 🔧 **Environment Variables**

Create a `.env` file with:
```env
NODE_ENV=production
PORT=3000
CUFINDER_API_KEY=your_key_here
IPINFO_TOKEN=your_token_here
```

## 📁 **Required Files for Deployment**
- ✅ `server.js` - Main server file
- ✅ `package.json` - Dependencies
- ✅ `public/` - Frontend files
- ✅ `.env` - Environment variables
- ✅ `osint.db` - SQLite database (will be created automatically)

## 🚀 **Start Commands**

### **Development:**
```bash
npm start
```

### **Production:**
```bash
NODE_ENV=production npm start
```

### **With PM2 (recommended for production):**
```bash
npm install -g pm2
pm2 start server.js --name "osint-engine"
pm2 startup
pm2 save
```

## 🔒 **Security Notes**
- All API keys are stored in environment variables
- CORS is configured for web access
- File cleanup prevents disk space issues
- No sensitive data is logged in production

## 📊 **Monitoring**
- Check logs: `pm2 logs osint-engine`
- Monitor performance: `pm2 monit`
- Restart if needed: `pm2 restart osint-engine`

## 🎯 **Your Website is Ready!**
- ✅ Database counts reset to 0
- ✅ Automatic file cleanup (30 minutes)
- ✅ Cross-platform compatibility
- ✅ Production optimizations
- ✅ Security hardened

**Deploy and enjoy your OSINT Lookup Engine! 🎉**
