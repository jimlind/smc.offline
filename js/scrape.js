var $scraper = "smcScrape.php";	// Scraper PHP Location
var $scrapeData = true;
var $scrapeImages = true;

// Wait for the DOM to be ready, then look for a form submittal.
$(document).ready(function() {
	$("#userForm").submit(function(event) {
		event.preventDefault();
		var $userName = $("#userInput").val();
		$scrapeData = $("#scrapeData").is(':checked');
		$scrapeImages = $("#scrapeImages").is(':checked');
		$.cookie("user", $userName, {expires: 365});
		if ($userName.length == 0) return false;
		$('#userForm').remove(); // Remove the form.
		
		if ($scrapeData) {
			var $url = "publicview.asp?username=" + $userName;
			$(document).trigger('buildStashes', [$url]);
		} else if (!$scrapeData && $scrapeImages) {
			$(document).trigger('buildImages');
		}		
		return false;
	});
	
	var $userCookie = $.cookie("user");
	if ($userCookie !== null) {
		$("#userInput").val($userCookie);
	}
	
	$("#nuclearOption").click(function() {
		$('#userForm').remove(); // Remove the form.
		$db.clearTables();
		logIt("Local database tables dropped.");
	});
});

// Build the Stashes - Custom event binding and unbinding
$(document).bind('buildStashes', function($event, $url) {
	$db.createStashes();
	getStashes($url);	
	$(document).unbind('buildStashes');
});

// Build the Series - Custom event binding and unbinding
$(document).bind('buildSeries', function($event) {	
	$db.createSeries();
	$db.processSelectAll('stash', 'stashQueryComplete');
	$(document).unbind('buildSeries');
});

// Build the Issues - Custom event binding and unbinding
$(document).bind('buildIssues', function($event) {	
	$db.createIssue();
	$db.processSelectAll('series', 'seriesQueryComplete');
	$(document).unbind('buildIssues');
});

// Build the Images - Custom event binding and unbinding
$(document).bind('buildImages', function($event) {	
	$db.createImage();
	$db.processSelectAll('series', 'imgSeriesQueryComplete');
	$(document).unbind('buildImages');
});

// Process Database Records from Stashes
$(document).bind('stashQueryComplete', function($event) {
	var $data = $db.data;
	getSeries($data);
	$(document).unbind('stashQueryComplete');
});

// Process Database Records from Series
$(document).bind('seriesQueryComplete', function($event) {
	var $data = $db.data;
	getIssues($data);
	$(document).unbind('seriesQueryComplete');
});

// Process Database Records for Images
$(document).bind('imgSeriesQueryComplete', function($event) {
	var $data = $db.data;
	getImages($data);
	$(document).unbind('imgSeriesQueryComplete');
});

/* Database Creation Object */
var $db = {
	// Database Reference
	database : openDatabase("database", "1.0", "Local StashMyComics Data", 5*1024*1024), //  5MB - Data
	imgdatabase : openDatabase("imgdatabase", "1.0", "Local StashMyComics Images", 45*1024*1024),  // 45MB - Images
	// Data Storage
	data : null,
	// Stashes Drop & Create
	createStashes : function(){  
		this.database.transaction(function($tx) {
			$tx.executeSql("DROP TABLE IF EXISTS stash");
			$tx.executeSql("CREATE TABLE stash (stashID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, title, url);");
		});
		logIt("Database table 'stash' created.");
	},
	// Stashes Insert
	insertStash : function($title, $url){
		this.database.transaction(function(tx) {
			tx.executeSql("INSERT INTO stash (title, url) VALUES (?, ?)", [$title, $url]);
		});
	},
	// Series Drop & Create
	createSeries : function(){
		this.database.transaction(function($tx) {
			$tx.executeSql("DROP TABLE IF EXISTS series");
			$tx.executeSql("CREATE TABLE series (seriesID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, stashID INTEGER, smcSeriesID INTEGER, title, publisher, url);");
		});
		logIt("Database table 'series' created.");
	},
	// Series Insert
	insertSeries : function($stashID, $smcSeriesID, $title, $publisher, $url){
		this.database.transaction(function(tx) {
			tx.executeSql("INSERT INTO series (stashID, smcSeriesID, title, publisher, url) VALUES (?, ?, ?, ?, ?)", [$stashID, $smcSeriesID, $title, $publisher, $url]);
		});
	},
	// Issues Drop & Create
	createIssue : function(){
		this.database.transaction(function($tx) {
			$tx.executeSql("DROP TABLE IF EXISTS issue");
			$tx.executeSql("CREATE TABLE issue (issueID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, seriesID INTEGER, smcIssueID INTEGER, issueNumber, published, info);");
		});
		logIt("Database table 'issue' created.");
	},
	// Issue Insert
	insertIssue : function($seriesID, $smcIssueID, $issueNumber, $published, $info) {
		this.database.transaction(function(tx) {
			tx.executeSql("INSERT INTO issue (seriesID, smcIssueID, issueNumber, published, info) VALUES (?, ?, ?, ?, ?)", [$seriesID, $smcIssueID, $issueNumber, $published, $info]);
		});
	},
	// Return All Data From Database
	processSelectAll : function($table, $eventName){
		var $local = this;
		this.database.transaction(function ($tx) {
			$tx.executeSql('SELECT * FROM '+$table, [], function ($tx, $results) {
				var $length = $results.rows.length;
				$local.data = new Array(); // Reset Data
				for(var $i = 0; $i < $length; $i++) {
					$local.data.push($results.rows.item($i));
				}
				$(document).trigger($eventName);
			});
		});
	},
	// **** Images Fetch Functionality ****
	// Image Drop & Create
	createImage : function(){
		this.imgdatabase.transaction(function($tx) {
			$tx.executeSql("DROP TABLE IF EXISTS image");
			$tx.executeSql("CREATE TABLE image (imageID INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, smcSeriesID INTEGER, data);");
		});
		logIt("Database table 'image' created.");
	},
	// Image Insert
	insertImage : function ($smcSeriesID, $input) {
		this.imgdatabase.transaction(function($tx) {
			$tx.executeSql("INSERT INTO image (smcSeriesID, data) VALUES (?, ?)", [$smcSeriesID, $input]);
		});
	},
	// **** Nuclear Option ****
	clearTables : function(){
		this.database.transaction(function($tx) {
			$tx.executeSql("DROP TABLE IF EXISTS stash");
			$tx.executeSql("DROP TABLE IF EXISTS series");
			$tx.executeSql("DROP TABLE IF EXISTS issue");
		});
		this.imgdatabase.transaction(function($tx) {
			$tx.executeSql("DROP TABLE IF EXISTS image");
		});
	}
}

/*
 * Load URL for Stashes
 * Create a div, set the contents, and parse the DOM.
 * Insert the data into the 'stashes' database.
 */
function getStashes($url) {
	$url = $scraper + "?i=" + escape($url);
	jQuery.ajax({'url': $url, 'async': false, 'success': function(result) {
	
		var $frame = $('<div style="display:none"/>').html(result);
		$('body').append($frame);
		var $anchors = $.makeArray($frame.find("#showAllStash a"));
		$frame.remove();
		
		// If there weren't any anchors you picked an invalid user
		if ($anchors.length == 0) {
			$db.createSeries();
			$db.createIssue();
			$db.createImage();
			logIt("Invalid User. Previous data deleted.");
			return false;
		}
		
		var $index = 1;
		/* Recursive function so setTimeout works. */
		function processStashAnchors() {
			var $anchor = $anchors.shift();
			var $href = $($anchor).attr('href');
			var $title = $($anchor).html();
			$db.insertStash($title, $href);
			logIt("Stash '" + $title + "' added.");
			
			if ($anchors.length > 0) {
				$index++;
				setTimeout(processStashAnchors, 50);
			} else {
				// All the stashes are done. Move along.
				logIt("All stashes found.");
				$(document).trigger('buildSeries');
			}
		}
		
		processStashAnchors();
		return false;
	}});
}

function getSeries($data) {
	var $i = 0;
	var $item;
	var $anchors = new Array();
	var $nextAnchor = new Array();
	
	function processSeries() {		
		// If all data has been used, item has been emptied, and no "next" button		
		if ($i >= $data.length && $item == null && $nextAnchor.length == 0) {
			logIt("All series found.");
			$(document).trigger('buildIssues');
			return false;
		}
		
		// If the item has been cleared or not instantiated
		if ($item == null) {
			if ($nextAnchor.length == 1) {
				$item = {'url': $nextAnchor.attr('href'), 'stashID': $data[$i-1].stashID};
				logIt("Scraping next page of series...");
			} else {
				$item = $data[$i];
				logIt("Scraping '" + $item.title + "' stash...");
				$i++;
			}			
			setTimeout(processSeries, 50);
			return false;
		}
		
		// If the anchors haven't been loaded or have been emptied
		if ($anchors.length == 0) {
			//load anchors via jquery
			var $url = $scraper + "?i=" + escape($item.url);
			jQuery.ajax({'url': $url, 'async': false, 'success': function(result) {
				// Add AJAX results to the DOM
				var $loaderFrame = $('<div style="display:none;" />').html(result);
				$('body').append($loaderFrame);
				$anchors = $.makeArray($loaderFrame.find("#titleResults a"));
				$nextAnchor = $loaderFrame.find(".searchNav a:contains('Next')").first();
				$loaderFrame.remove();
				setTimeout(processSeries, 50);
			}});
		} else {
			//shift anchors and insert in database
			var $anchor = $($anchors.shift());
			var $href = $anchor.attr('href');
			var $title = $anchor.html();
			var $sid = $href.match(/sid=([0-9]+)/)[1];
			var $publisher = $anchor.parents('tr').children('td').first().html();
			$db.insertSeries($item.stashID, $sid, $title, $publisher, $href);
			logIt("-&nbsp;Series '" + $title + "' added.");
			
			// If all anchors have been used, clear item so it can be reset.
			if($anchors.length == 0) {
				$item = null;
			}
			setTimeout(processSeries, 50);
		}
		return false;
	}
	
	processSeries();
}

function getIssues($data) {
	var $i = 0;
	var $item;
	var $rows = new Array();
	var $nextAnchor = new Array();
	
	function processIssues() {		
		// If all data has been used and item has been emptied
		if ($i >= $data.length && $item == null) {
			logIt("All series found.");
			if ($scrapeImages) {
				$(document).trigger('buildImages');
			} else {
				finishUp();
			}
			return false;
		}
		
		// If the item has been cleared or not instantiated
		if ($item == null) {
			if ($nextAnchor.length == 1) {
				$item = {'url': $nextAnchor.attr('href'), 'seriesID': $data[$i-1].seriesID};
				logIt("Scraping next page of issues...");
			} else {
				$item = $data[$i];
				logIt("Scraping '" + $item.title + "' series...");
				$i++;
			}			
			setTimeout(processIssues, 50);
			return false;
		}
		
		// If the rows haven't been loaded or have been emptied
		if ($rows.length == 0) {
			//load rows via jquery
			var $url = $scraper + "?i=" + escape($item.url);
			jQuery.ajax({'url': $url, 'async': false, 'success': function(result) {
				// Add AJAX results to an object
				var $loaderDiv = $('<div />').html(result);
				$rows = $.makeArray($loaderDiv.find("#catRes tr"));
				$rows.shift(); // First row is useless
				$nextAnchor = $loaderDiv.find(".searchNav a:contains('Next')").first();
				setTimeout(processIssues, 50);
			}});
		} else {
			//shift rows and insert in database
			var $row = $($rows.shift());
			var $tableData = $row.find("td");
			
			var $anchor = $($($tableData[2]).html());
			var $published = $($tableData[3]).html();
			var $info = $($tableData[4]).html();
			var $href = $anchor.attr("href");
			var $kcid = $href.match(/kcid=([0-9]+)/)[1];
			var $issue = $anchor.html();
			$db.insertIssue($item.seriesID, $kcid, $issue, $published, $info);
			logIt("&nbsp-&nbsp;Issue: '" + $issue + "' added. " + "(" + $published + ")");
			
			// If all rows have been used, clear item so it can be reset.
			if($rows.length == 0) {
				$item = null;
			}
			setTimeout(processIssues, 50);
		}
		return false;
	}
	
	processIssues();
}

function getImages($data) {
	var $i = 0;
	var $item;
	
	function processImages() {
		// If all data has been used and item has been emptied
		if ($i >= $data.length && $item == null) {
			logIt("All images found.");
			finishUp();
			return false;
		}
		
		// If the item has been cleared or not instantiated
		if ($item == null) {
			$item = $data[$i];
			logIt("Fetching image for '" + $item.title + "'...");
			$i++;
			setTimeout(processImages, 50);
			return false;
		}
		
		//load anchor tag via jquery
		var $url = $scraper + "?i=" + escape($item.url);
		jQuery.ajax({'url': $url, 'async': false, 'success': function(result) {
			// Add AJAX results to an object
			var $loaderDiv = $('<div />').html(result);
			var $anchor = $.makeArray($loaderDiv.find("#catRes tr:eq(1) td:eq(5) a"));
			var $src = $($anchor).attr("href");
			var $html = $($anchor).html();
			var $smcSeriesID = $item.smcSeriesID;				
			$item = null;
				
			if($html == "N" || $src == null) {
				setTimeout(processImages, 100);
				return false;
			}
				
			var $canvas = $('<canvas height="150" width="150" />');
			var $ctx = $canvas[0].getContext('2d');	
			var $image = new Image();
			$($image).attr('height', '200');
			logImage($image);
			
			$image.onload = function() {
				var $ratio = $image.width / $image.height;
				var $width = Math.round(150*$ratio);
				$canvas.attr("width", $width);
				$ctx.drawImage($image, 0, 0, $width, 150);
				var $base64 = $ctx.canvas.toDataURL("image/png");
				$db.insertImage($smcSeriesID, $base64);
				setTimeout(processImages, 500);
				return false;
			}
			$image.src = $scraper + "?i=" + escape($src) + "&type=jpg";
			return false;
		}});
		return false;
	}
	processImages();
}

function logIt($string) {
	var $console = $('#console');
	var $heightBefore = $console.prop("scrollHeight");
	var $tag = $('<p />').html($string);
	$console.append($tag);
	if ($console.prop("scrollHeight") > $heightBefore) {
		$console.find("p:first").remove();
	}
}

function logImage($img) {
	$('#image_container img').remove();
	$('#image_container').append($img);
}

function finishUp() {
	logIt("");
	logIt("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
	logIt("Your scrape has completed.");
	logIt("Close this page and view your stashes in the main view.");
	logIt("%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%");
}