<?php

require_once('class.playwire.php');
class playwire_tab {
	
	protected $playwire;
	protected $api_key;

	function __construct($plugin) {
		
		$this->api_key = get_option('playwire-api-key');
		if(!empty($this->api_key)) {
			$this->playwire = new Playwire($this->api_key);
			add_action('admin_init', array(&$this, 'admin_init'));
		}
		
	}

	function admin_init() {
		//Enqueue JS & CSS
		add_action('media_upload_playwire', array(&$this, 'add_styles') );
		//Add actions/filters
		add_filter('media_upload_tabs', array(&$this, 'tabs'));
		add_action('media_upload_playwire', array(&$this, 'tab_handler'));
	
	}
	
	//Add a tab to the media uploader:
	function tabs($tabs) {
		$tabs['playwire'] = 'Add From Playwire';	
		return $tabs;
	}
	
	function add_styles() {
		//Enqueue support files.
		if ( 'media_upload_playwire' == current_filter() )
			wp_enqueue_style('media');
	}

	//Handle the actual page:
	function tab_handler(){


		//Set the body ID
		$GLOBALS['body_id'] = 'media-upload';

		//Do an IFrame header
		iframe_header( 'Add From Playwire');

		//Add the Media buttons	
		media_upload_header();

		$list_table = new playwire_list_table();
		$list_table->tab_view = true;
		$list_table->prepare_items();
		
		echo '<h3 class="media-title">Add a video from Playwire</h3>';
		$list_table->display();

		//Do a footer
		iframe_footer();
	}
}

?>
