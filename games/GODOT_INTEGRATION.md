# Godot Game Integration Guide

This guide shows you how to embed Godot games (exported to HTML5/WebAssembly) and integrate them with the game hosting server.

## Table of Contents
- [Quick Start](#quick-start)
- [Exporting from Godot](#exporting-from-godot)
- [JavaScript Bridge](#javascript-bridge)
- [Server Communication](#server-communication)
- [Complete Example](#complete-example)

## Quick Start

1. Export your Godot game to HTML5
2. Place exported files in your game folder
3. Create an `index.html` wrapper that loads Godot and the GameAPI
4. Use JavaScript bridge to communicate between Godot and server

## Exporting from Godot

### Step 1: Install HTML5 Export Template

In Godot:
1. Go to **Editor → Manage Export Templates**
2. Download and install the template for your Godot version

### Step 2: Configure Export Settings

1. Go to **Project → Export**
2. Add **HTML5** preset
3. Configure settings:
   - **Export Type**: Regular
   - **Head Include**: Leave empty (we'll add scripts in wrapper)
   - **Custom HTML Shell**: Leave default
   - Enable **Export with Debug** during development

### Step 3: Export

1. Click **Export Project**
2. Choose your game folder: `games/your-godot-game/`
3. Name it `game.html` (we'll create a wrapper `index.html`)
4. Export

**Files created:**
```
games/your-godot-game/
├── game.html           # Godot's generated HTML
├── game.js             # Godot engine
├── game.wasm           # Compiled game
├── game.pck            # Game resources
└── game.png            # Icon
```

## JavaScript Bridge

Godot can call JavaScript functions and JavaScript can call Godot functions.

### Calling JavaScript from Godot

In your Godot GDScript:

```gdscript
# Define the JavaScript interface
var js_bridge = JavaScript.create_object("GodotBridge")

func _ready():
    # Check if we're running in browser
    if OS.has_feature("JavaScript"):
        # Call JavaScript function
        JavaScript.eval("""
            window.sendToServer = function(event, data) {
                if (window.gameAPI) {
                    gameAPI.emit(event, data);
                }
            }
        """)

func send_game_event(event_name, data):
    if OS.has_feature("JavaScript"):
        var json_data = JSON.print(data)
        JavaScript.eval("window.sendToServer('" + event_name + "', " + json_data + ")")

# Example: Send player position
func _on_player_moved(position):
    send_game_event("player-moved", {
        "x": position.x,
        "y": position.y
    })
```

### Calling Godot from JavaScript

In your `index.html`:

```javascript
// Wait for Godot to load
window.addEventListener('load', () => {
    // Function to call Godot from JavaScript
    window.callGodot = function(functionName, args) {
        if (window.godotInstance) {
            // Call a Godot method
            // Note: You need to expose methods in Godot using JavaScript singleton
        }
    }

    // Listen for server events and send to Godot
    gameAPI.on('player-moved', (data, user) => {
        // Send to Godot
        if (window.godotInstance) {
            // Call Godot method to handle other player movement
            window.godotInstance.Module.ccall(
                'receive_player_position',
                'void',
                ['number', 'number'],
                [data.x, data.y]
            );
        }
    });
});
```

## Server Communication

### Pattern 1: Godot → Server

```gdscript
# In Godot
extends Node2D

func _ready():
    if OS.has_feature("JavaScript"):
        JavaScript.eval("""
            window.GodotGame = {
                emit: function(event, data) {
                    if (window.gameAPI) {
                        gameAPI.emit(event, JSON.parse(data));
                    }
                }
            }
        """)

func send_to_server(event, data_dict):
    if OS.has_feature("JavaScript"):
        var json = JSON.print(data_dict)
        JavaScript.eval("window.GodotGame.emit('" + event + "', '" + json + "')")

# Usage
func _on_shoot():
    send_to_server("player-shoot", {"direction": "up", "power": 10})
```

### Pattern 2: Server → Godot

Create a JavaScript singleton in Godot:

**File: `autoload/JavaScriptBridge.gd`**
```gdscript
extends Node

signal server_event(event_name, data, user)

var _event_queue = []

func _ready():
    if OS.has_feature("JavaScript"):
        JavaScript.eval("""
            window.GodotBridge = {
                sendToGodot: function(eventName, data, user) {
                    // Will be processed by Godot
                    window._godotEventQueue = window._godotEventQueue || [];
                    window._godotEventQueue.push({
                        event: eventName,
                        data: data,
                        user: user
                    });
                }
            };

            // Listen to GameAPI events
            if (window.gameAPI) {
                window.gameAPI.on('player-shoot', function(data, user) {
                    window.GodotBridge.sendToGodot('player-shoot', data, user);
                });
            }
        """)

func _process(_delta):
    if OS.has_feature("JavaScript"):
        # Check for queued events from JavaScript
        var result = JavaScript.eval("window._godotEventQueue || []")
        if result and result.length() > 0:
            for event in result:
                emit_signal("server_event", event.event, event.data, event.user)
            JavaScript.eval("window._godotEventQueue = []")
```

Then in your game scenes:
```gdscript
func _ready():
    JavaScriptBridge.connect("server_event", self, "_on_server_event")

func _on_server_event(event_name, data, user):
    match event_name:
        "player-shoot":
            spawn_bullet(data.direction, data.power)
        "player-moved":
            update_player_position(user.id, data.x, data.y)
```

## Complete Example

### index.html (Wrapper)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Godot Game</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000;
    }
    #game-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    canvas {
      border: none;
      outline: none;
    }
  </style>
</head>
<body>
  <div id="game-container">
    <canvas id="canvas"></canvas>
  </div>

  <!-- Load Godot engine -->
  <script src="/game/game.js"></script>

  <script>
    // Wait for GameAPI to be ready (injected by server)
    window.addEventListener('load', async () => {
      // Initialize Godot
      const engine = new Engine();

      try {
        await engine.init();
        engine.startGame({
          'executable': '/game/game',
          'canvas': document.getElementById('canvas'),
          'canvasResizePolicy': 2 // Adaptive
        }).then((instance) => {
          window.godotInstance = instance;
          console.log('Godot game loaded');

          // Set up GameAPI bridge
          if (window.gameAPI && gameAPI.isAuthenticated()) {
            setupGameAPIBridge();
          }
        });
      } catch (err) {
        console.error('Failed to start Godot game:', err);
      }
    });

    function setupGameAPIBridge() {
      const user = gameAPI.getUser();
      console.log('Setting up GameAPI bridge for', user.nickname);

      // Create bridge object for Godot to use
      window.GodotServerBridge = {
        // Godot calls this to send events to server
        emit: function(event, dataJson) {
          try {
            const data = JSON.parse(dataJson);
            gameAPI.emit(event, data);
          } catch (e) {
            console.error('Failed to emit event:', e);
          }
        },

        // Get current user info
        getUser: function() {
          return JSON.stringify(user);
        }
      };

      // Listen for server events and queue them for Godot
      window._godotEventQueue = [];

      // Example: Listen for generic game events
      gameAPI.on('game-event', (data, fromUser) => {
        window._godotEventQueue.push({
          event: data.event || 'unknown',
          data: data,
          user: fromUser
        });
      });

      // Or listen for specific events
      gameAPI.on('player-moved', (data, fromUser) => {
        window._godotEventQueue.push({
          event: 'player-moved',
          data: data,
          user: fromUser
        });
      });
    }
  </script>
</body>
</html>
```

### GDScript Example

**Main.gd:**
```gdscript
extends Node2D

var player_positions = {}

func _ready():
    if OS.has_feature("JavaScript"):
        # Initialize JavaScript bridge
        JavaScript.eval("""
            console.log('Godot game ready');
        """)

func _process(_delta):
    # Process server events
    if OS.has_feature("JavaScript"):
        var events = JavaScript.eval("window._godotEventQueue || []")
        if events:
            for i in range(len(events)):
                var event = events[i]
                handle_server_event(event.event, event.data, event.user)
            JavaScript.eval("window._godotEventQueue = []")

func handle_server_event(event_name, data, user):
    match event_name:
        "player-moved":
            update_remote_player(user.id, data.x, data.y)

func send_player_position(pos):
    if OS.has_feature("JavaScript"):
        var data = {"x": pos.x, "y": pos.y}
        var json = JSON.print(data)
        JavaScript.eval("window.GodotServerBridge.emit('player-moved', '" + json + "')")

func update_remote_player(player_id, x, y):
    # Update other player's position in your game
    if not player_positions.has(player_id):
        player_positions[player_id] = create_remote_player()

    player_positions[player_id].position = Vector2(x, y)
```

## Server Module (server.js)

```javascript
let playerPositions = new Map();

function handleConnection(socket, io, user) {
  console.log(`[Godot Game] ${user.nickname} connected`);

  // Send current player positions to new player
  const positions = Array.from(playerPositions.entries()).map(([id, pos]) => ({
    userId: id,
    ...pos
  }));

  socket.emit('game-event', {
    event: 'all-player-positions',
    data: { players: positions }
  });

  // Handle player movement
  socket.on('game-event', (eventData) => {
    if (eventData.event === 'player-moved') {
      // Store position
      playerPositions.set(user.id, {
        x: eventData.data.x,
        y: eventData.data.y,
        user: user
      });

      // Broadcast to others
      socket.broadcast.emit('game-event', {
        event: 'player-moved',
        data: eventData.data,
        user: user
      });
    }
  });
}

function handleDisconnection(socket, io, user) {
  playerPositions.delete(user.id);
}

module.exports = {
  handleConnection,
  handleDisconnection
};
```

## Tips & Best Practices

### 1. **Use Signals in Godot**
```gdscript
signal player_moved(position)

func _ready():
    connect("player_moved", self, "_on_player_moved")

func _on_player_moved(pos):
    send_to_server("player-moved", {"x": pos.x, "y": pos.y})
```

### 2. **Debounce Frequent Events**
```gdscript
var last_position_sent = Vector2.ZERO
var position_send_threshold = 10.0

func update_position(new_pos):
    if new_pos.distance_to(last_position_sent) > position_send_threshold:
        send_player_position(new_pos)
        last_position_sent = new_pos
```

### 3. **Handle Offline Play**
```gdscript
func send_to_server(event, data):
    if OS.has_feature("JavaScript"):
        # Send to server
        pass
    else:
        # Local testing/offline mode
        print("Would send: ", event, " ", data)
```

### 4. **User Profile in Godot**
```gdscript
var current_user = {}

func _ready():
    if OS.has_feature("JavaScript"):
        var user_json = JavaScript.eval("window.GodotServerBridge.getUser()")
        current_user = JSON.parse(user_json)

        # Use player colors
        $Player.modulate = Color(current_user.playerColor)
```

## Common Patterns

### Multiplayer Movement
- Godot: Send position on `_physics_process` with throttling
- Server: Broadcast to all other players
- Godot: Interpolate remote player positions

### Turn-Based Games
- Server: Manages whose turn it is
- Godot: Disables input when not player's turn
- Server: Validates all moves

### Real-Time Action
- Godot: Send actions immediately
- Server: Broadcast to all, validate if needed
- Godot: Play animations for remote players

## Troubleshooting

**Godot not loading:**
- Check browser console for errors
- Ensure all Godot files are in `/game/` directory
- Verify export settings in Godot

**JavaScript bridge not working:**
- Use `OS.has_feature("JavaScript")` checks
- Test with `JavaScript.eval("console.log('test')")`
- Check browser console for errors

**GameAPI undefined:**
- Verify scripts are injected by server
- Check network tab for script loading
- Make sure you're accessing via `/play` route

## Resources

- [Godot HTML5 Export Documentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- [Godot JavaScript Integration](https://docs.godotengine.org/en/stable/classes/class_javascript.html)
- Game Module Template: `GAME_MODULE_TEMPLATE.md`
