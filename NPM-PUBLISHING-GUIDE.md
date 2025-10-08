# 📦 NPM Publishing Guide for AI Database Helper

## 🚀 **Quick Start - Publishing to NPM**

### **Option 1: Publish as Unscoped Package (Easiest)**

```bash
# 1. Update package name to be unscoped
sed -i '' 's/"@yolovibecode\/aidb"/"aidb-helper"/g' package.json

# 2. Rebuild
npm run build:force

# 3. Publish
npm publish --access public --ignore-scripts
```

### **Option 2: Create NPM Organization (Recommended)**

1. **Go to NPM Website:**
   - Visit: https://www.npmjs.com
   - Login to your account

2. **Create Organization:**
   - Click your profile → "Add Organization"
   - Name: `yolovibecode`
   - Make it public (free)

3. **Publish:**
   ```bash
   npm publish --access public --ignore-scripts
   ```

### **Option 3: Use Your NPM Username as Scope**

```bash
# 1. Check your username
npm whoami

# 2. Update package.json to use your username
# Change "@yolovibecode/aidb" to "@YOUR_USERNAME/aidb"

# 3. Publish
npm publish --access public --ignore-scripts
```

---

## 📋 **Pre-Publication Checklist**

- [x] ✅ All code committed
- [x] ✅ Version tagged (v1.0.1)
- [x] ✅ All packages built
- [x] ✅ Tests passing (95/95)
- [x] ✅ README.md complete
- [x] ✅ LICENSE file present
- [ ] 🔑 NPM login complete
- [ ] 📦 Organization/scope created (if using scoped package)

---

## 🔧 **Current Package Configuration**

```json
{
  "name": "@yolovibecode/aidb",
  "version": "1.0.1",
  "bin": {
    "aidb": "./packages/cli/dist/index.js"
  }
}
```

---

## 🎯 **Post-Publication Steps**

### 1. **Verify Package Published**
```bash
npm view @yolovibecode/aidb
# or
npm view aidb-helper
```

### 2. **Test Installation**
```bash
# Test in a new directory
mkdir test-install && cd test-install
npm install -g @yolovibecode/aidb
aidb --help
```

### 3. **Push to GitHub**
```bash
git push origin main
git push origin v1.0.1
```

### 4. **Create GitHub Release**
- Go to: https://github.com/YOLOVibeCode/ai-db-helper/releases
- Click "Create a new release"
- Select tag: v1.0.1
- Title: "Release v1.0.1: QueryPlanner & IndexAdvisor"
- Description: Copy from DEPLOYMENT-READY.md

### 5. **Update README Badges**
Add to README.md:
```markdown
[![npm version](https://badge.fury.io/js/%40yolovibecode%2Faidb.svg)](https://www.npmjs.com/package/@yolovibecode/aidb)
[![npm downloads](https://img.shields.io/npm/dm/@yolovibecode/aidb.svg)](https://www.npmjs.com/package/@yolovibecode/aidb)
```

---

## 💡 **Installation Instructions for Users**

### Global Installation (CLI Tool)
```bash
npm install -g @yolovibecode/aidb

# Verify installation
aidb --version
aidb --help
```

### Local Project Installation
```bash
npm install @yolovibecode/aidb

# Use in code
import { SchemaCache, QueryExecutor } from '@yolovibecode/aidb';
```

---

## 🔍 **Troubleshooting**

### "Scope not found" Error
**Problem:** The `@yolovibecode` organization doesn't exist on NPM

**Solutions:**
1. Create the organization at npmjs.com (free for public packages)
2. OR publish as unscoped: `"name": "aidb-helper"`
3. OR use your NPM username: `"name": "@yourusername/aidb"`

### "Not logged in" Error
```bash
npm login
# Enter username, password, email, and OTP
```

### "Package already exists" Error
```bash
# Version already published - bump version
npm version patch  # 1.0.1 -> 1.0.2
npm version minor  # 1.0.1 -> 1.1.0
npm version major  # 1.0.1 -> 2.0.0
```

---

## 📊 **What Gets Published**

The NPM package includes:
- `packages/cli/dist/` - CLI executable
- `packages/core/dist/` - Core business logic
- `packages/adapters/dist/` - Database adapters
- `packages/contracts/dist/` - TypeScript interfaces
- `README.md` - Documentation
- `LICENSE` - MIT License

**Total Package Size:** ~23 KB (compressed: ~8 KB)

---

## 🎉 **Success!**

Once published, users can install with:
```bash
npm install -g @yolovibecode/aidb
```

And use immediately:
```bash
aidb connect mydb --connection-string "mysql://..."
aidb schema mydb
aidb relationships mydb
```

---

**Need help? Check the full documentation in the README.md or visit the GitHub repository.**

