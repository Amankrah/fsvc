# Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1️⃣ Configure Your Backend URL

Edit `src/config/env.ts` and update the `DEV_API_URL`:

```typescript
const DEV_API_URL = 'http://YOUR_BACKEND_IP:PORT/api';
```

**Examples:**
- Same machine: `'http://localhost:3000/api'`
- Android emulator: `'http://10.0.2.2:3000/api'`
- Physical device: `'http://192.168.1.100:3000/api'` (use your computer's IP)

**Find your local IP:**
- Windows: `ipconfig` (look for IPv4 Address)
- Mac/Linux: `ifconfig` or `ip addr`

### 2️⃣ Start the Development Server

```bash
npm start
```

This will show a QR code. Choose your platform:
- Press `a` for Android emulator
- Press `i` for iOS simulator
- Scan QR with Expo Go app (physical device)
- Press `w` for web browser

### 3️⃣ Backend Requirements

Your backend must implement these endpoints:

#### POST `/auth/login`
```json
// Request
{ "email": "user@example.com", "password": "password123" }

// Response
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

#### POST `/auth/register`
```json
// Request
{ "email": "user@example.com", "password": "password123", "name": "John Doe" }

// Response (same as login)
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": { "id": "123", "email": "user@example.com", "name": "John Doe" }
}
```

#### POST `/auth/refresh`
```json
// Request
{ "refresh_token": "eyJhbGc..." }

// Response
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

#### POST `/auth/logout`
```
Headers: Authorization: Bearer {access_token}
Response: { "message": "Logged out successfully" }
```

#### GET `/auth/me`
```
Headers: Authorization: Bearer {access_token}
Response: { "id": "123", "email": "user@example.com", "name": "John Doe" }
```

---

## 📱 Testing on Physical Device

1. **Connect to same WiFi** as your development machine
2. **Find your computer's IP address**
3. **Update** `src/config/env.ts` with your IP
4. **Scan QR code** with Expo Go app
5. **Make sure firewall allows** port 8081 and your backend port

---

## 🔍 Troubleshooting

### "Network request failed"
- ✅ Check backend is running
- ✅ Verify `src/config/env.ts` has correct IP/port
- ✅ For Android emulator: use `10.0.2.2` instead of `localhost`
- ✅ Check firewall isn't blocking connections
- ✅ Ensure device and computer on same network

### "Unable to resolve module"
```bash
npm install
npx expo start --clear
```

### App crashes on startup
```bash
# Clear cache and restart
rm -rf node_modules
npm install
npx expo start --clear
```

### TypeScript errors
```bash
npm run lint
```

---

## 📚 Full Documentation

See [README.md](./README.md) for complete documentation including:
- Full feature list
- Detailed architecture
- Production build instructions
- Security best practices
- Performance optimizations

---

## 🎯 What You Get

✅ **Login/Register screens** with validation
✅ **Automatic token refresh** when expired
✅ **Encrypted token storage**
✅ **Protected routes** (redirects if not logged in)
✅ **Tablet-optimized** layouts
✅ **TypeScript** type safety
✅ **Material Design 3** UI components

---

Need help? Check the full README or create an issue!