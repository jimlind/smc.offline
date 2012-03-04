var $db = openDatabase("database", "1.0", "Local StashMyComics Data", 5*1024*1024);
var $im = openDatabase("imgdatabase", "1.0", "Local StashMyComics Images", 45*1024*1024);

$(document).ready(function(){
	if (navigator.onLine) {
		$(".online").show();
		$(".online").css("display", "block");
	} else {
		$(".offline").show();
		$(".offline").css("display", "block");
	}
	
	$("#showStashes").bind("click", function(event){
		$("#splash").hide();
		$("#stashes").show();
		$("#series").hide();
		$("#issues").hide();
	});
	
	$("#showSeries").bind("click", function(event){
		$("#splash").hide();
		$("#stashes").hide();
		$("#series").show();
		$("#issues").hide();
	});
	
	$("#showIssues").bind("click", function(event){
		$("#splash").hide();
		$("#stashes").hide();
		$("#series").hide();
		$("#issues").show();
	});
	
	var $stashList = $("#stashList");
	$db.transaction(function ($tx) {
		$tx.executeSql("SELECT stashID, title FROM stash", [], function ($tx, $results) {
			var $length = $results.rows.length;
			if ($length == 0) {
				promptForScrape();
				return false;
			}
			for(var $i = 0; $i < $length; $i++) {
				var $item = $results.rows.item($i);
				var $li = $('<li />').html($item.title).attr("stashID", $item.stashID);
				$stashList.append($li);
			}
			$("#showStashes").trigger("click");
			return false;
		}, promptForScrape);
	});
	
	$("#stashList li").live("click", function(event){
	var $id = $(event.target).attr("stashID");
	var $seriesList = $("#seriesList");
	$seriesList.children().remove();
		$db.transaction(function ($tx) {
		var $query = "SELECT seriesID, smcSeriesID, title, publisher FROM series WHERE stashID = " + $id;
		$tx.executeSql($query, [], function ($tx, $results) {
		var $length = $results.rows.length;
			for(var $i = 0; $i < $length; $i++) {
			var $item = $results.rows.item($i);
			var $text = $item.title + " " + $item.publisher;
			var $li = $('<li />').html($text).attr("seriesID", $item.seriesID).attr("smcID", $item.smcSeriesID);
			$seriesList.append($li);
		}
		});
	});
	$("#showSeries").trigger("click");
	});
	
	$("#seriesList li").live("click", function(event){
	var $id = $(event.target).attr("seriesID");
	var $smc = $(event.target).attr("smcID");
	var $issueList = $("#issueList");
	var $h1 = $("#issues").find("h1");
	var $img = $("#issues").find("img");
	$issueList.children().remove();
		$db.transaction(function ($tx) {
		var $query = "SELECT * FROM series, issue WHERE series.seriesID = issue.seriesID AND series.seriesID = ?";
		$tx.executeSql($query, [$id], function ($tx, $results) {
		var $length = $results.rows.length;
		if ($length == 0) {
			$h1.html("No Issues Found");
			return false;
		}
		$h1.html("Issues of " + $results.rows.item(0).title);
		var $length = $results.rows.length;
		for(var $i = 0; $i < $length; $i++) {
			var $item = $results.rows.item($i);
			var $text = $item.issueNumber + " :: " + $item.published;
			if ($item.info != "") {
			$text += " :: " + $item.info;
			}
			var $li = $('<li />').html($text);
			$issueList.append($li);
		}
		});
	});
	$im.transaction(function ($tx) {
		var $query = "SELECT * FROM image WHERE smcSeriesID = ?";
		$tx.executeSql($query, [$smc], function ($tx, $results) {
		$img.attr("src", $results.rows.item(0).data);
		});
	});
	$("#showIssues").trigger("click");
	});
	
	function promptForScrape() {
		$("#scrapePrompt").show();
		$("#scrapePrompt button").live("click", function(event){
			window.location.href = "scrape.html";
		});
	}
});
