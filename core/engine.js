/* You DID it!
 * 
 * This file is part of You DID it!
 * 
 * You DID it! is licenced under public domain and or CC-0
 * See http://creativecommons.org/publicdomain/zero/1.0/
 * 
 * You DID it! uses jQuery, licenced by the jQuery Fundation
 * under the MIT Licence (see https://jquery.org/license/)
 * 
 * Please notice that only the game engine is in public domain.
 * Game data (pictures, stories, texts and more) are subject to their
 * own licence which may differ.
 */

// Game variables
/////////////////
var game;
var i18n = {};
var inventory = {};
var objects = [];
var flags = {};
var current_state_index = 0;
var current_state = null;
/** Number of bad actions to suggest before showing hints.
 * Must be ordered. May be overriden in game data. */
var hintThresholds = [5, 10, 15, 20, 25];
/** Counts the number of useless actions to display hints */
var badActions = 0;
var hintsShown = 0;

var action_state = null;
var PICK_ACTION = 0;
var PICK_TARGET = 1;
var WILDCARD = "*";

var action_picked = null;
var ACTION_MAP = "_map_item_clicked";
var targets_picked = [];

// General tools
////////////////

String.prototype.format = function (args) {
	var str = this;
	return str.replace(String.prototype.format.regex, function(item) {
		var intVal = parseInt(item.substring(1, item.length - 1));
		var replace;
		if (intVal >= 0) {
			replace = args[intVal];
		} else if (intVal === -1) {
			replace = "{";
		} else if (intVal === -2) {
			replace = "}";
		} else {
			replace = "";
		}
		return replace;
	});
};
String.prototype.format.regex = new RegExp("{-?[0-9]+}", "g");

function _get( name )
{
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return null;
  else
    return results[1];
}

function isDefined(varName) {
	return typeof(window[varName]) != "undefined";
}

function escHtml(string) {
	return string;
}
function escAttr(string) {
	return string;
}
function escUrl(string) {
	return string;
}
/** Escape string to include it in javascript code, surrounded by ' '
 * and by " " for html element. */
function escJs(string) {
	var esc = string.replace(new RegExp("'", 'g'), "\\'");
	esc = esc.replace(new RegExp("\"", 'g'), "&quot;");
	return esc;
}

function translate(string, array) {
	if (string in i18n) {
		if (Array.isArray(array)) {
			for (var i = 0; i < array.length; i++) {
				array[i] = translate(array[i]);
			}
			return i18n[string].format(array);
		} else {
			return i18n[string];
		}
	}
	return string;
}

function showTextResult(textResult) {
	var title = null;
	if (action_picked != ACTION_MAP) {
		// Get the title on regular command (shows the command itself)
		var i18n = "_pick_target_" + targets_picked.length + "_completed";
		var i18n_args = [];
		i18n_args.push(translate(action_picked['code']));
		for (var i = 0; i < targets_picked.length; i++) {
			i18n_args.push(targets_picked[i]);
		}
		// Look for alternate linker word in picked action
		if ('linker' in action_picked) {
			i18n_args.push(translate(action_picked['linker']));
		} else {
			// Put default linker word
			i18n_args.push(translate('_pick_target_linker'));
		}
		title = translate(i18n, i18n_args);
	}
	showResult(textResult, title);
}

/** Show result popup with message and optionnal title */
function showResult(string, title) {
	switch (arguments.length) {
	case 1:
		title = null;
	}
	var result = null;
	if (Array.isArray(string)) {
		result = "";
		for (var i = 0; i < string.length; i++) {
			result += "<p>" + escHtml(translate(string[i])) + "</p>";
		}
	} else {
		result = "<p>" + escHtml(translate(string)) + "</p>";
	}
	var res = jQuery("#result");
	res.removeClass("result-hidden");
	res.addClass("result-shown");
	html = "";
	if (title != null) {
		html += "<div class=\"title\">" + escHtml(title) + "</div>";
	}
	html += "<div>" + result + "</div><div id=\"click-to-close\">" + escHtml(translate("_click_to_close")) + "</div>"
	res.html(html);
}
/** Hide result popup */
function closeResult() {
	var res = jQuery("#result");
	res.addClass("result-hidden");
	res.removeClass("result-shown");
	res.html("");
}

// Game functions
/////////////////

/** Set an item in given inventory location and update display */
function setItem(location, item) {
	// Add to inventory
	inventory[location] = item;
	// Display
	var span = jQuery("#inventory ul li#location-" + escAttr(location) + " .item");
	if (item == null) {
		span.html("");
	} else {
		span.html(escHtml(translate(item)));
		span.attr('style',"text-shadow: 0px 0px 10px #ff0000");
		span.attr('onmouseout',"this.removeAttribute('style'); this.removeAttribute('onmouseout');");
	}
}
function removeItem(location, item) {
	if (location in inventory && inventory[location] == item) {
		setItem(location, null);
	}
	
}

function hasItem(location, item) {
	if (location in inventory && inventory[location] == item) {
		return true;
	}
	return false;
}

function addObject(item) {
	// Add object if not already in list
	if (objects.indexOf(item) != -1) {
		return;
	}
	objects.push(item);
	objects.sort();
	// Display
	var id = objects.indexOf(item);
	
	if (id == 0) {
		jQuery("#objects ul").prepend("\n<li id=\"object-" + escAttr(item) + "\" onclick=\"javascript:targetPicked('" + escJs(item) + "');\" style=\"text-shadow: 0px 0px 10px #ff0000\" onmouseout=\"this.removeAttribute('style'); this.removeAttribute('onmouseout');\">" + escHtml(translate(item)) + "</li>");
	} else {
		jQuery("#object-" + escAttr(objects[id-1])).after("\n<li id=\"object-" + escAttr(item) + "\" onclick=\"javascript:targetPicked('" + escJs(item) + "');\" style=\"text-shadow: 0px 0px 10px #ff0000\" onmouseout=\"this.removeAttribute('style'); this.removeAttribute('onmouseout');\">" + escHtml(translate(item)) + "</li>");
	}

}
function removeObject(item) {
	for (var i = 0; i < objects.length; i++) {
		if (objects[i] == item) {
			jQuery("#object-" + escAttr(item)).remove();
			objects.splice(i, 1);
			return;
		}
	}
}

function hasObject(item) {
	for (var i = 0; i < objects.length; i++) {
		if (objects[i] == item) {
			return true;
		}
	}
	return false;
}

/** Clicked on an action, if action is not already picked pick it
 * and expect a target. Otherwise reset action picking with new one. */
function actionPicked(action_code) {
	var my_action = null;
	// Get action object from action code
	for (var i = 0; i < actions.length; i++) {
		var action = actions[i];
		if (action['code'] == action_code) {
			my_action = action;
			break;
		}
	}
	if (my_action != null) {
		// No state check as picking resets the automat
		action_picked = my_action;
		targets_picked = [];
		if (my_action['targets'] == 0) {
			// Action is not expecting target, proceed it
			proceedAction();
		} else {
			// Expect target
			action_state = PICK_TARGET;
			updateNotification();
		}
	}
}

/** Clicked on a target */
function targetPicked(target_code) {
	if (action_state == PICK_TARGET) {	
		// Add the selected target to action
		targets_picked.push(target_code);
		// Look for an available action (even for incomplete action)
		var actions = current_state['actions']
		var selected_action = [action_picked['code']];
		for (var i = 0; i < targets_picked.length; i++) {
			selected_action.push(targets_picked[i]);
		}
		var my_action = null;
		for (var i = 0; i < actions.length; i++) {
			// Check if action is the same length as current action
			var action = actions[i]['action'];
			if (action.length != selected_action.length) {
				continue;
			}
			// Check if the action is the same or wildcard and assign it
			var ok = 1;
			for (var j = 0; j < selected_action.length; j++) {
				if (selected_action[j] != action[j]
						&& action[j] != WILDCARD) {
					ok = 0;
					break;
				}
			}
			if (ok == 1) {
				my_action = actions[i];
				break;
			}
		}
		// If action is fully selected or action found, show result
		if (action_picked['targets'] == targets_picked.length
				|| my_action != null) {
			proceedAction(my_action);
		} else {
			updateNotification();
		}
	}
}

/** Clicked on an inventory item */
function inventoryPicked(location) {
	targetPicked(inventory[location]);
}

/** Update notification area with current action state */
function updateNotification() {
	switch (action_state) {
	case PICK_ACTION:
		// No action picked
		jQuery("#notification div").html(translate("_pick_action"));
		break;
	case PICK_TARGET:
		// Action picked, expecting targets
		var picked_count = targets_picked.length;
		var targets_count = action_picked['targets'];
		var i18n = "_pick_target_" + picked_count + "_of_" + targets_count;
		var i18n_args = [];
		i18n_args.push(translate(action_picked['code']));
		for (var i = 0; i < targets_picked.length; i++) {
			i18n_args.push(translate(targets_picked[i]));
		}
		// Look for alternate linker word in picked action
		if ('linker' in action_picked) {
			i18n_args.push(translate(action_picked['linker']));
		} else {
			// Put default linker word
			i18n_args.push(translate('_pick_target_linker'));
		}
		html = translate(i18n, i18n_args);
		jQuery("#notification div").html(html);
		break;
	}
}

/** Process a set of conditions using either 'and' or 'or' logic. **/
function processConditions(conditions, type) {
	if ('has_item' in conditions) {
		if (Array.isArray(conditions['has_item'])) {
			for (var i = 0; i < conditions['has_item'].length; i++) {
				if (hasObject(conditions['has_item'][i])) {
					if (type == 'or') {
						return true;
					}
				} else {
					if (type == 'and') {
						return false;
					}
				}
			}
		} else {
			if (hasObject(conditions['has_item'])) {
				if (type == 'or') {
					return true;
				}
			} else {
				if (type == 'and') {
					return false;
				}
			}
		}
	}
	if ('has_inventory' in conditions) {
		for (var loc in conditions['has_inventory']) {
			if (hasItem(loc, conditions['has_inventory'][loc])) {
				if (type == 'or') {
					return true;
				}
			} else {
				if (type == 'and') {
					return false;
				}
			}
		}
	}
	if ('check' in conditions) {
		for (var variable in conditions['check']) {
			if (flags[variable] == conditions['check'][variable]) {
				if (type == 'or') {
					return true;
				}
			} else {
				if (type == 'and') {
					return false;
				}
			}
		}
	}
	if ('random' in conditions) {
			if (Math.random() * 100 < conditions['random']) {
				if (type == 'or') {
					return true;
				}
			} else {
				if (type == 'and') {
					return false;
				}
			}
	}
	if (type == 'or') {
		return false;
	} else {
		return true;
	}
}	

/** Proceed an action result. If null show default impossible action. */
function proceedAction(action) {
	// Reset action command and update
	action_state = PICK_ACTION;
	target_picked = [];
	updateNotification();
	// If no transition show default result
	if (action == null) {
		showTextResult(translate("_you_cant_do_that"));
		badAction();
		return;
	}
	// Proceed transition if any
	if (!proceedResult(action['result']) && action_picked['no_hints'] !== true) {
		badAction();
	}
}

/** Get action from map and proceed it's result. Called on map click. */
function proceedMapResult(index) {
	// Reset action command to map action
	action_picked = ACTION_MAP;
	target_picked = [];
	proceedResult(current_state['map-items'][index]['result']);
	// Reset action command completely (no state on map action)
	action_state = PICK_ACTION;
	action_picked = null;
	updateNotification();
}

/** Parse and proceed a result object. Returns true if it makes
 * the game progress. */
function proceedResult(result) {
	var progressed = false;
	if ('if' in result) {
		var type = 'none';
		if ('and' in result['if']) {
			type = 'and';
		} else if ('or' in result['if']) {
			type = 'or';
		}
		if (type !== 'none') {
			if (processConditions(result['if'][type],type)) {
				if (proceedResult(result['if']['then'])) {
					progressed = true;
				}
			} else {
				if (proceedResult(result['if']['else'])) {
					progressed = true;
				}
			}
		}
	}
	if ('text' in result) {
		showTextResult(result['text']);
	}
	if ('move_to' in result) {
		if (result['move_to'] == 'next') {
			setState(current_state_index + 1);
		} else {
			setState(result['move_to']);
		}		
		progressed = true;
	}
	if ('item' in result) {
		if (Array.isArray(result['item'])) {
			for (var i = 0; i < result['item'].length; i++) {
				addObject(result['item'][i]);
			}
		} else {
			addObject(result['item']);
		}
		progressed = true;
	}
	if ('remove_item' in result) {
		if (Array.isArray(result['remove_item'])) {
			for (var i = 0; i < result['remove_item'].length; i++) {
				removeObject(result['remove_item'][i]);
			}
		} else {
			removeObject(result['remove_item']);
		}
		progressed = true;
	}
	if ('inventory' in result) {
		for (var loc in result['inventory']) {
			setItem(loc, result['inventory'][loc]);
		}
		progressed = true;
	}
	if ('remove_inventory' in result) {
		for (var loc in result['remove_inventory']) {
			removeItem(loc, result['remove_inventory'][loc]);
		}
		progressed = true;
	}
	if ('set' in result) {
		for (var variable in result['set']) {
			flags[variable]= result['set'][variable];
		}
		progressed = true;
	}
	if ('story' in result) {
		current_state['story'] = result['story'];
		setStory(current_state);
		progressed = true;
	}
	if ('map' in result) {
		current_state['map'] = current_state['map-alts'][result['map']]['map'];
		current_state['map-items'] = current_state['map-alts'][result['map']]['map-items'];
		setMap(current_state);
		progressed = true;
	}
	if ('game_over' in result) {
		badAction();
		badAction();
		game_over(result['game_over']);
		progressed = true;
	}
	if ('congratulations' in result) {
		game_end(result['congratulations']);
		progressed = true;
	}
	return progressed;
}

// Hints management
///////////////////

/** Incremend the bad action count and check
 * if a hint should be shown */
function badAction() {
	badActions++;
	// Check if a threshold is reached (or even multiple)
	while (hintThresholds.length > hintsShown
			&& hintThresholds[hintsShown] <= badActions) {
		showNextHint();
	}
}

function showNextHint() {
	if ('hints' in current_state
			&& current_state['hints'].length > hintsShown) {
		var hint = current_state['hints'][hintsShown];
		var hintTitle = translate("_hint_{0}", [hintsShown + 1])
		var html = "<li onclick=\"javascript:showResult('" + escJs(translate(hint)) + "', '" + escJs(hintTitle) + "');\">" + escHtml(hintTitle) + "</li>";
		jQuery("#hints").append(html);
	}
	hintsShown++;
}

function resetHints() {
	// Hide hints
	jQuery("#hints").html("");
	// Reset counters
	badActions = 0;
	hintsShown = 0;
}

// State function
/////////////////

function setState(index) {
	current_state_index = index;
	current_state = states[index];
	setStatePicture(current_state);
	setStory(current_state);
	setMap(current_state);
	resetHints();
	action_state = PICK_ACTION;
	updateNotification();
}

function setStatePicture(state) {
	if ('picture' in state) {
		if ('big_picture' in state) {
			jQuery("#picture a").attr("href", "./games/" + escUrl(game) + "/" + escUrl(state['big_picture']));
		} else {
			jQuery("#picture a").attr("href", "./games/" + escUrl(game) + "/" + escUrl(state['picture']));
		}
		jQuery("#picture img").attr("src", "./games/" + escUrl(game) + "/" + escUrl(state['picture']));
	}
}

function setStory(state) {
	lines = state['story']
	jQuery("#situation").html("");
	for (var i = 0; i < lines.length; i++) {
		jQuery("#situation").append("<p>" + escHtml(translate(lines[i])) + "</p>");
	}
}

function setMap(state) {
	jQuery("#map img").attr("src", "./games/" + escUrl(game) + "/" + escUrl(state['map']));
	jQuery("#map map").html("");
	var html = "";
	for (var i = 0; i < state['map-items'].length; i++) {
		var item = state['map-items'][i];
		var area = "<area coords=\"" + escAttr(item['area']) + "\" shape=\"" + escAttr(item['shape']) + "\" onclick=\"javascript:proceedMapResult(" + i + ");\" />";
		html += area;
	}
	jQuery("#map map").html(html);
}
// Initializing functions
/////////////////////////

function loadGame() {
	// Get game from g param
	game = _get('g');
	if (game == null) {
		return false;
	}
	// Add scripts and style
	jQuery("head").append("<script type=\"text/javascript\" src=\"./games/" + escUrl(game) + "/game.js\"></script>");
	jQuery("head").append("<script type=\"text/javascript\" src=\"./games/" + escUrl(game) + "/language.js\"></script>");
	jQuery("head").append("<link rel=\"stylesheet\" type=\"text/css\" href=\"./games/" + escUrl(game) + "/game.css\"/>");
	// Check for game data
	if (!isDefined('states')) {
		return false;
	}
	// Ok
	return true;
}

function loadI18n() {
	for (var key in default_core_language) {
		i18n[key] = default_core_language[key];
	}
	for (var key in default_language) {
		i18n[key] = default_language[key];
	}
}
function loadAltI18n(lang) {
	if (lang == null) {
		return;
	}
	jQuery("head").append("<script type=\"text/javascript\" src=\"./core/language-" + escUrl(lang) + ".js\"></script>");
	jQuery("head").append("<script type=\"text/javascript\" src=\"./games/" + escUrl(game) + "/language-" + escUrl(lang) + ".js\"></script>");
	if (!isDefined('language')) {
		return;
	}
	if (isDefined('core_language')) {
		for (var key in core_language) {
			i18n[key] = core_language[key];
		}
	}
	for (var key in language) {
		i18n[key] = language[key];
	}
}

function setupUI() {
	// Translate UI labels
	jQuery("#inventory .title").html(escHtml(translate("_inventory")));
	jQuery("#objects .title").html(escHtml(translate("_objects")));
	jQuery("#start-game button").html(escHtml(translate("_start_game")));
	jQuery("#try-again button").html(escHtml(translate("_try_again")));
	// Set game title
	if (isDefined('title')) {
		jQuery("title").html(escHtml(translate(title)));
	}
	// Set game footer (can contain html)
	if (isDefined('footer')) {
		jQuery("#footer").html(translate(footer));
	}
}

function setupIntro() {
	if (!isDefined('intro')) {
		return;
	}
	if (!Array.isArray(intro)) {
		intro = [intro];
	}
	if (intro.length == 0) {
		return false;
	}
	var html = "";
	for (var i = 0; i < intro.length; i++) {
		var step = intro[i];
		if ('story' in step) {
			if (Array.isArray(step['story'])) {
				for (var j = 0; j < step['story'].length; j++) {
					html += "<p>" + escHtml(translate(step['story'][j])) + "</p>";
				}
			} else {
				html += "<p>" + escHtml(translate(step['story'])) + "</p>";
			}
		}
		if ('picture' in step) {
			html += "<div class=\"intro-picture\">";
			if ('big_picture' in step) {
				html += "<a href=\"./games/" + escUrl(game) + "/" + escUrl(step['big_picture']) + "\">";
			}
			html += "<img src=\"./games/" + escUrl(game) + "/" + escUrl(step['picture']) + "\" />";
			if ('big_picture' in step) {
				html += "</a>";
			}
			html += "</div>";
		}
	}
	jQuery("#intro-screen").prepend(html);
	return true;
}

function setupActions() {
	for (var i = 0; i < actions.length; i++) {
		jQuery("#actions ul").append("<li onclick=\"javascript:actionPicked('" + escJs(actions[i]['code']) + "');\"))>" + escHtml(translate(actions[i]['code'])) + "</li>");
	}
}

function setupLocations() {
	for (var i = 0; i < locations.length; i++) {
		inventory[locations[i]] = null;
		jQuery("#inventory ul").append("<li id=\"location-" + escAttr(locations[i]) + "\"><span class=\"location\" onclick=\"javascript:targetPicked('"+ escJs(locations[i]) + "');\">" + escHtml(translate(locations[i])) + "</span><span class=\"item\" onclick=\"javascript:inventoryPicked('" + escJs(locations[i]) + "');\"></span>");
	}
}

function setupInventory() {
	for (var loc in starting_inventory) {
		setItem(loc, starting_inventory[loc]);
		var span = jQuery("#inventory ul li#location-" + escAttr(loc) + " .item");
		span.removeAttr('style');
		span.removeAttr('onmouseover');
	}
}

function setupObjects() {
	for (var i = 0; i < starting_objects.length; i++) {
		addObject(starting_objects[i]);
	}
}

// Starting/ending functions
////////////////////////////

function start() {
	jQuery("#intro-screen").hide();
	jQuery("#game-screen").show();
}

/** Init and show a game over screen by bad_ends index */
function game_over(end_index) {
	jQuery("#game-screen").hide();
	var state = bad_ends[end_index];
	if ('picture' in state) {
		if ('big_picture' in state) {
			jQuery("#game-over-picture a").attr("href", "./games/" + escUrl(game) + "/" + escUrl(state['big_picture']));
		} else {
			jQuery("#game-over-picture a").attr("href", "./games/" + escUrl(game) + "/" + escUrl(state['picture']));
		}
		jQuery("#game-over-picture img").attr("src", "./games/" + escUrl(game) + "/" + escUrl(state['picture']));
	}
	lines = state['story']
	jQuery("#game-over-situation").html("");
	for (var i = 0; i < lines.length; i++) {
		jQuery("#game-over-situation").append("<p>" + escHtml(translate(lines[i])) + "</p>");
	}
	jQuery("#game-over-screen").show();
}

/** Return to previous game state */
function retry() {
	jQuery("#game-over-screen").hide();
	jQuery("#game-screen").show();
}

/** Init and show an ending screen by good_ends index */
function game_end(end_index) {
	jQuery("#game-screen").hide();
	var state = good_ends[end_index];
	if ('picture' in state) {
		if ('big_picture' in state) {
			jQuery("#game-end-picture a").attr("href", "./games/" + escUrl(game) + "/" + escUrl(state['big_picture']));
		} else {
			jQuery("#game-end-picture a").attr("href", "./games/" + escUrl(game) + "/" + escUrl(state['picture']));
		}
		jQuery("#game-end-picture img").attr("src", "./games/" + escUrl(game) + "/" + escUrl(state['picture']));
	}
	lines = state['story']
	jQuery("#game-end-situation").html("");
	for (var i = 0; i < lines.length; i++) {
		jQuery("#game-end-situation").append("<p>" + escHtml(translate(lines[i])) + "</p>");
	}
	jQuery("#game-end-screen").show();	
}

jQuery().ready(function() {
	if (!loadGame()) {
		jQuery("#game-screen").hide();
		jQuery("#error-screen").html("Game not loaded");
		jQuery("#error-screen").show();
		return;
	}
	loadI18n();
	loadAltI18n(_get("lang"));
	setupUI();
	if (setupIntro()) {
		jQuery("#game-screen").hide();
		jQuery("#intro-screen").show();
	}
	setupActions();
	setupLocations();
	setupInventory();
	setupObjects();
	setState(0);
});