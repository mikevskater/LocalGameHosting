# Godot Game Template

This template provides everything you need to integrate a Godot game with the game hosting server.

## Quick Start

### 1. Create Your Godot Game

1. Create your game in Godot Engine
2. Add `ServerBridge.gd` to your project as an **AutoLoad** singleton:
   - Project → Project Settings → AutoLoad
   - Add `ServerBridge.gd` with name "ServerBridge"

### 2. Export Your Game

1. In Godot: **Project → Export**
2. Add **HTML5** preset (install export template if needed)
3. Export to this folder as `game.html`
4. Files created: `game.html`, `game.js`, `game.wasm`, `game.pck`

### 3. Test Your Game

1. Place exported files in this folder
2. Start the server and switch to this game in admin panel
3. Visit `http://localhost:3000/play`

## Using the ServerBridge in Your Game

### In Your Main Scene

```gdscript
extends Node2D

func _ready():
    # Connect to server events
    ServerBridge.connect("player_joined", self, "_on_player_joined")
    ServerBridge.connect("player_left", self, "_on_player_left")
    ServerBridge.connect("player_moved", self, "_on_player_moved")

    # Get current user info
    var user = ServerBridge.get_current_user()
    print("Playing as: ", user.nickname)

    # Use player colors
    $Player.modulate = ServerBridge.get_player_color()

func _on_player_joined(player_data):
    print(player_data.nickname, " joined the game")
    # Spawn remote player

func _on_player_left(player_id):
    print("Player ", player_id, " left")
    # Remove remote player

func _on_player_moved(player_id, position, user):
    # Update remote player position
    if remote_players.has(player_id):
        remote_players[player_id].position = Vector2(position.x, position.y)
```

### Send Player Position

```gdscript
extends KinematicBody2D

var last_sent_position = Vector2.ZERO
var send_threshold = 10.0  # Send every 10 pixels

func _physics_process(delta):
    # Your movement code
    var velocity = get_input_velocity()
    velocity = move_and_slide(velocity)

    # Send position to server when moved significantly
    if position.distance_to(last_sent_position) > send_threshold:
        ServerBridge.send_player_position(position)
        last_sent_position = position
```

### Send Player Actions

```gdscript
func _input(event):
    if event.is_action_pressed("shoot"):
        # Shoot locally
        shoot()

        # Tell server (and other players)
        ServerBridge.send_player_action("shoot", {
            "direction": get_aim_direction(),
            "power": 10
        })
```

### Handle Other Players' Actions

```gdscript
func _ready():
    ServerBridge.connect("player_action", self, "_on_player_action")

func _on_player_action(player_id, action_data, user):
    match action_data.action:
        "shoot":
            spawn_bullet(
                player_id,
                action_data.direction,
                action_data.power
            )
        "jump":
            play_jump_animation(player_id)
```

### Chat System

```gdscript
# Send chat message
func send_chat():
    var message = $ChatInput.text
    ServerBridge.send_chat_message(message)

# Receive chat messages
func _ready():
    ServerBridge.connect("chat_message_received", self, "_on_chat_message")

func _on_chat_message(data, user):
    var formatted = "[color=" + user.nameColor + "]" + user.nickname + "[/color]: " + data.message
    $ChatLog.append_bbcode(formatted)
```

## Server Module (server.js)

The `server.js` file handles:
- Storing game state
- Validating player actions (if needed)
- Broadcasting events to all players
- Managing player connections/disconnections

You can customize it for your game's specific needs!

## Example: Multiplayer Platformer

### Player.gd
```gdscript
extends KinematicBody2D

var velocity = Vector2.ZERO
var SPEED = 200

func _ready():
    # Use player's color
    $Sprite.modulate = ServerBridge.get_player_color()

func _physics_process(delta):
    velocity.x = Input.get_axis("ui_left", "ui_right") * SPEED
    velocity.y += 980 * delta  # Gravity

    if Input.is_action_just_pressed("ui_up") and is_on_floor():
        velocity.y = -500
        ServerBridge.send_player_action("jump", {})

    velocity = move_and_slide(velocity, Vector2.UP)

    # Send position periodically
    if Engine.get_frames_drawn() % 3 == 0:  # Every 3 frames
        ServerBridge.send_player_position(position)
```

### Main.gd
```gdscript
extends Node2D

var RemotePlayer = preload("res://RemotePlayer.tscn")
var remote_players = {}

func _ready():
    ServerBridge.connect("player_joined", self, "_on_player_joined")
    ServerBridge.connect("player_left", self, "_on_player_left")
    ServerBridge.connect("player_moved", self, "_on_player_moved")
    ServerBridge.connect("player_action", self, "_on_player_action")

func _on_player_joined(player_data):
    var remote = RemotePlayer.instance()
    remote.player_id = player_data.id
    remote.nickname = player_data.nickname
    remote.modulate = Color(player_data.playerColor)
    add_child(remote)
    remote_players[player_data.id] = remote

func _on_player_left(player_id):
    if remote_players.has(player_id):
        remote_players[player_id].queue_free()
        remote_players.erase(player_id)

func _on_player_moved(player_id, pos, user):
    if remote_players.has(player_id):
        remote_players[player_id].target_position = Vector2(pos.x, pos.y)

func _on_player_action(player_id, action_data, user):
    if action_data.action == "jump" and remote_players.has(player_id):
        remote_players[player_id].play_jump_animation()
```

## Tips

1. **Throttle Position Updates** - Don't send every frame, use threshold or timer
2. **Interpolate Remote Players** - Smooth movement between position updates
3. **Validate on Server** - Check if actions are valid before broadcasting
4. **Handle Offline Mode** - Use `OS.has_feature("JavaScript")` checks
5. **Test Locally First** - Use Godot's built-in export preview

## File Structure

```
godot-template/
├── game.json           # Game metadata
├── index.html          # HTML wrapper (handles loading)
├── server.js           # Server-side logic
├── ServerBridge.gd     # Godot singleton (add to your project)
├── README.md           # This file
└── (Your Godot exports)
    ├── game.html
    ├── game.js
    ├── game.wasm
    └── game.pck
```

## Troubleshooting

**Game doesn't load:**
- Check browser console for errors
- Ensure all 4 Godot files are exported
- Verify export settings in Godot

**ServerBridge not working:**
- Make sure it's added as AutoLoad
- Check that `OS.has_feature("JavaScript")` returns true in browser
- Look for JavaScript errors in console

**Events not received:**
- Check server console for logs
- Verify `server.js` is handling the event
- Make sure you're connected (check status indicator)

**Other players not visible:**
- Check that their positions are being sent
- Verify remote player spawning logic
- Look for errors in browser console

## Resources

- Full documentation: `../GODOT_INTEGRATION.md`
- Server module guide: `../GAME_MODULE_TEMPLATE.md`
- [Godot HTML5 Export Docs](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
