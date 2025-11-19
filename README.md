# Sky Ace - Battle City Clone

A multiplayer tank battle game with real-time physics and WebSocket communication.

## Deployment to Vercel

**Important Note:** Vercel's free tier does not support WebSockets in production. For WebSocket support, you have two options:

### Option 1: Deploy to a WebSocket-friendly platform
Consider deploying to platforms that support WebSockets:
- **Railway.app** (Recommended)
- **Render.com**
- **Heroku**
- **DigitalOcean App Platform**

### Option 2: Use Vercel with limitations
The current setup will work on Vercel for static file serving, but WebSocket connections will fall back to polling which may cause performance issues.

## Local Development

```bash
npm install
npm start
```

Visit `http://localhost:3000` to play.

## Controls

- **W / Up Arrow**: Accelerate
- **S / Down Arrow**: Reverse
- **A / Left Arrow**: Turn Left
- **D / Right Arrow**: Turn Right
- **Shift + Turn**: Rotate Turret Only
- **Space**: Fire

## Deploying to Railway (Recommended)

1. Create account at [railway.app](https://railway.app)
2. Install Railway CLI: `npm i -g @railway/cli`
3. Login: `railway login`
4. Initialize: `railway init`
5. Deploy: `railway up`

Your game will be live with full WebSocket support!
