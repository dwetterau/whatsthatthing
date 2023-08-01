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

## TODO:

-   [x] Fetch Airplane data
-   [x] Fetch Boat data
-   [x] Lock down panning, and allow zoom in (but not out)
-   [x] Fetch Airplane data server side, with periodic refresh (or realtime, if available)
-   [x] Fetch more information about planes on click
-   [x] Add user login for storing collectables
-   [x] Implement first collectable
-   [x] Fetch Amtrak / train data
-   [ ] Better notifications when you earn an achievement
-   [ ] Fetch boat data
-   [ ] Fetch plane model data
-   [ ] Fetch flight numbers
-   [ ] Fetch train model info
-   [ ] Productionize?

### Improvements:

-   [x] Sometimes the client isn't getting or applying updates that the server is supposedly getting.
-   [x] Hardcode or round regions so that we re-use them more often (or don't allow too many)
-   [x] Setup eslint to automatically reformat on save (remove newlines, etc.)
