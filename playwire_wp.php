<?php 
/***************************************************************************
Plugin Name:  Playwire for Wordpress
Plugin URI:   http://www.playwire.com/features/wordpress_plugin
Description:  This plugin allows you to upload and manage your Playwire videos
Version:      2.2
Author:       Playwire
Author URI:   http://www.playwire.com/
Author Name:  Playwire
**************************************************************************/


add_action('plugins_loaded', 'playwire_load_tab');

function playwire_load_tab() {
	require_once 'include/class.playwire_tab.php';
	require_once 'include/class.playwire_media.php';
	require_once 'include/class.playwire_list_table.php';

	$GLOBALS['playwire_tab'] = new playwire_tab(plugin_basename(__FILE__));
	$GLOBALS['playwire_media'] = new playwire_media(plugin_basename(__FILE__));
}


?>
