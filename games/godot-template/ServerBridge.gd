# ServerBridge.gd
# Place this in your Godot project as an AutoLoad (Singleton)
# Project Settings → AutoLoad → Add this script as "ServerBridge"

extends Node

# Signals for game events
signal server_connected
signal server_disconnected
signal player_joined(player_data)
signal player_left(player_id)
signal player_moved(player_id, position, user)
signal player_action(player_id, action_data, user)
signal game_state_received(state)
signal chat_message_received(message, user)

# Current user info
var current_user = {}
var is_connected = false

# Event queue (processed in _process)
var _event_queue = []

func _ready():
	if OS.has_feature("JavaScript"):
		print("ServerBridge: Initializing JavaScript bridge")
		_initialize_javascript_bridge()
		_load_user_info()
	else:
		print("ServerBridge: Running in native mode (no server connection)")

func _initialize_javascript_bridge():
	# Create JavaScript interface for receiving events
	JavaScript.eval("""
		window._godotEventQueue = window._godotEventQueue || [];

		// Listen to GameAPI events if available
		if (window.gameAPI) {
			// Generic game event listener
			window.gameAPI.on('player-moved', function(data, user) {
				window._godotEventQueue.push({
					event: 'player-moved',
					data: data,
					user: user
				});
			});

			window.gameAPI.on('player-action', function(data, user) {
				window._godotEventQueue.push({
					event: 'player-action',
					data: data,
					user: user
				});
			});

			window.gameAPI.on('player-joined', function(data, user) {
				window._godotEventQueue.push({
					event: 'player-joined',
					data: data,
					user: user
				});
			});

			window.gameAPI.on('player-left', function(data, user) {
				window._godotEventQueue.push({
					event: 'player-left',
					data: data,
					user: user
				});
			});

			window.gameAPI.on('game-state', function(data, user) {
				window._godotEventQueue.push({
					event: 'game-state',
					data: data,
					user: user
				});
			});

			window.gameAPI.on('chat-message', function(data, user) {
				window._godotEventQueue.push({
					event: 'chat-message',
					data: data,
					user: user
				});
			});

			console.log('GameAPI event listeners registered');
		}
	""")

func _load_user_info():
	if OS.has_feature("JavaScript"):
		var user_json = JavaScript.eval("window.GodotServerBridge ? window.GodotServerBridge.getUserProfile() : '{}'")
		if user_json:
			current_user = JSON.parse(user_json)
			print("ServerBridge: Loaded user - ", current_user.nickname)

func _process(_delta):
	if OS.has_feature("JavaScript"):
		_process_event_queue()
		_check_connection_status()

func _process_event_queue():
	# Get events from JavaScript
	var events = JavaScript.eval("window._godotEventQueue || []")

	if events and typeof(events) == TYPE_ARRAY and events.size() > 0:
		for event in events:
			_handle_server_event(event)

		# Clear the queue
		JavaScript.eval("window._godotEventQueue = []")

func _check_connection_status():
	var connected = JavaScript.eval("window.GodotServerBridge ? window.GodotServerBridge.isConnected() : false")

	if connected != is_connected:
		is_connected = connected
		if is_connected:
			emit_signal("server_connected")
		else:
			emit_signal("server_disconnected")

func _handle_server_event(event):
	var event_name = event.get("event", "")
	var data = event.get("data", {})
	var user = event.get("user", {})

	match event_name:
		"player-moved":
			emit_signal("player_moved", user.id, data, user)

		"player-action":
			emit_signal("player_action", user.id, data, user)

		"player-joined":
			emit_signal("player_joined", user)

		"player-left":
			emit_signal("player_left", data.id)

		"game-state":
			emit_signal("game_state_received", data)

		"chat-message":
			emit_signal("chat_message_received", data, user)

# Public API: Send events to server

func emit_event(event_name: String, data: Dictionary):
	"""Send a game event to the server"""
	if OS.has_feature("JavaScript"):
		var json_data = JSON.print(data)
		var js_code = "window.GodotServerBridge.emit('" + event_name + "', '" + json_data + "')"
		JavaScript.eval(js_code)
	else:
		print("Would send event: ", event_name, " ", data)

func send_player_position(position: Vector2):
	"""Convenience function to send player position"""
	emit_event("player-moved", {
		"x": position.x,
		"y": position.y
	})

func send_player_action(action: String, action_data: Dictionary = {}):
	"""Convenience function to send player actions"""
	var data = action_data.duplicate()
	data["action"] = action
	emit_event("player-action", data)

func send_chat_message(message: String):
	"""Send a chat message"""
	emit_event("chat-message", {
		"message": message
	})

# Utility functions

func get_current_user() -> Dictionary:
	"""Get current user info"""
	return current_user

func get_player_color() -> Color:
	"""Get current player's color as Godot Color"""
	if current_user.has("playerColor"):
		return Color(current_user.playerColor)
	return Color.white

func get_name_color() -> Color:
	"""Get current player's name color as Godot Color"""
	if current_user.has("nameColor"):
		return Color(current_user.nameColor)
	return Color.white

func is_server_connected() -> bool:
	"""Check if connected to server"""
	return is_connected
