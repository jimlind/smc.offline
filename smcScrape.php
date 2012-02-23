<?php
/* To avoid abuse, only allow scraping of StashMyComics */

// Just to be nice to the guys at StashMyComics.
sleep(0.5);

// Setup the request
$baseURL = 'http://www.stashmycomics.com/html';

// Sanitize input
$i = filter_input(INPUT_GET, 'i', FILTER_SANITIZE_STRING);
// Decode input
$i = urldecode($i);
// Remove all characters that are weird
$i = preg_replace('#[^a-z0-9:/& .?=-]#i', '', $i);
// Replace space with plus;
$i = str_replace(' ', '+', $i);

// Sanitize input
$type = filter_input(INPUT_GET, 'type', FILTER_SANITIZE_STRING);

// I've never been able to trust the PHP-cURL library, so I do it the hard way.
$fetchScript = "curl '$baseURL/$i'";
if ($type === 'jpg') {
    $fetchScript = "curl '$i'";
    header('Content-Type: Image');
}    

$output = shell_exec($fetchScript);
if($output == null) {
    echo "FAILURE TO COMMUNICATE";
    die;
}
// Remove some bits of unneccesary HTML
$output = preg_replace('/<head(.*?)head>/s', '', $output);	// Remove the HTMl Header
$output = preg_replace('/<script(.*?)script>/s', '', $output);	// Remove all Scripts
$output = preg_replace('/<form(.*?)form>/s', '', $output);	// Remove all Forms

//var_dump($fetchScript);
echo $output;