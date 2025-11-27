# What's that thing?

This is a web app that shows current positions of nearby planes, trains, and boats (hopefully).
Over time, I want to turn this into a Swarm-type game experience where you can collect different types of vehicles with a simple experience for you and your friends.

This concept really only works in places with lots of vehicles running about. That means places with busy ports or (someday) public transit should be the most fun to play in.

Ideas for types of "collectables" you might eventually be able to get:

-   Vessel makes / models
-   Vessels at various speeds / altitudes
-   Vessels owned by various companies
-   Famous vessels?

The idea is for it to work only where you currently are.
The concept is for this to be a thing you do when you're sitting on a rooftop in Manhattan, and wondering: "What's that thing?".

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- A Convex account and project (for backend services)
- An Auth0 account and application (for authentication)

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in the project root with the following variables:
   ```
   VITE_CONVEX_URL=your_convex_deployment_url
   VITE_AUTH0_DOMAIN=your_auth0_domain
   VITE_AUTH0_CLIENT_ID=your_auth0_client_id
   ```
   
   - **Convex URL**: Get this from your Convex dashboard after deploying your Convex functions
   - **Auth0 Domain & Client ID**: Get these from your Auth0 application settings

3. **Deploy Convex functions (if not already deployed):**
   ```bash
   npx convex dev
   ```
   
   This will deploy your Convex functions and generate the necessary types. You can run this in a separate terminal if you want to watch for changes.

4. **Start the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   
   The application will be available at `http://localhost:5173`

### Development Scripts

- `npm run dev` - Start the development server
- `npm run build:client` - Build the client for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview the production build
- `npm run prettier-format` - Format code with Prettier

## TODO:

-   [x] Fetch Airplane data
-   [x] Fetch Boat data
-   [x] Lock down panning, and allow zoom in (but not out)
-   [x] Fetch Airplane data server side, with periodic refresh (or realtime, if available)
-   [x] Fetch more information about planes on click
-   [x] Add user login for storing collectables
-   [x] Implement first collectable
-   [x] Fetch Amtrak / train data
-   [x] Better notifications when you earn an achievement
-   [ ] Fetch boat data
-   [ ] Fetch plane model data
-   [ ] Fetch flight numbers
-   [ ] Fetch train model info
-   [ ] Productionize?

### Improvements:

-   [x] Sometimes the client isn't getting or applying updates that the server is supposedly getting.
-   [x] Hardcode or round regions so that we re-use them more often (or don't allow too many)
-   [x] Setup eslint to automatically reformat on save (remove newlines, etc.)
-   [ ] Prune the list of locations (remove duplicates)
-   [ ] Store locations for some amount of time (15 minutes?) after last hearing about them
-   [ ] Show lines of the path of objects as they move?
