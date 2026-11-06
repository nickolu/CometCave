# CometCave

CometCave is a modern web application featuring a collection of interactive browser games. Built with Next.js, React, and PixiJS, it offers an engaging gaming experience with a sleek, responsive interface.

## 🎮 Features

- A library of small browser games — daily trivia, word puzzles, card games, a coin pusher, a dungeon master and more
- Generated content (a dungeon master's turn, a summoned creature) requires sign-in and draws from a per-player daily allowance — see `src/lib/ai/limits.ts`
- Modern, responsive UI with Tailwind CSS
- Smooth animations and transitions
- Dark theme with beautiful gradients

## 🛠️ Tech Stack

- **Framework**: Next.js 15.3.0
- **UI Library**: React 19
- **Styling**: Tailwind CSS
- **Game Engine**: PixiJS 8.9.1
- **Language**: TypeScript

## 🚀 Getting Started

1. **Clone the repository**

```bash
git clone <repository-url>
cd cometcave.com
```

2. **Install dependencies**

```bash
yarn install
```

3. **Run the development server**

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## 🔧 Development

- `yarn dev`: Start the development server with Turbopack
- `yarn build`: Build the application for production
- `yarn start`: Start the production server
- `yarn lint`: Run ESLint for code quality

## 📁 Project Structure

```
src/
  ├── app/                # Next.js app directory
  │   ├── components/     # Reusable UI components
  │   ├── ring-toss/     # Ring Toss game implementation
  │   ├── globals.css    # Global styles
  │   └── page.tsx       # Home page
  └── ...
```

## 🎨 Styling

The project uses Tailwind CSS for styling, featuring:

- Responsive design
- Custom gradients
- Glassmorphism effects
- Smooth transitions
