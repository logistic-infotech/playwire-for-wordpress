<?php
if(!class_exists('WP_List_Table')){
	require_once( ABSPATH . 'wp-admin/includes/class-wp-list-table.php' );
}
class playwire_list_table extends WP_List_Table {
	protected $api_key;
	protected $playwire = false;

	public $tab_view = false;

	function __construct() {
		parent::__construct(array(
			'singular'	=> 'video',
			'plural' 	=> 'videos',
			'ajax' 		=> false
		));

		$this->api_key = get_option('playwire-api-key');
		if(!empty($this->api_key)) {
			$this->playwire = new Playwire($this->api_key);
		} 
	}

	# Extra markup before or after the list
	function extra_tablenav($which) {
		switch($which) {
			case 'top':
				echo '<!--before the table-->';
				break;
			case 'bottom':
				echo '<!--after the table-->';
				break;
		}
	}

	# List of available bulk actions.
	function get_bulk_actions(){
		return array();
		#return array('delete' => 'Delete');
	}

	# The list of columns 
	function get_columns() {
		return array(
			#'cb' => '<input type="checkbox" />',
			'thumbnail' => '',
			'name' => __('Name'),
			'views' => __('Views'),
			'created' => __('Creation Date'),
			'category' => __('Category'),
		);
	}

	# Decide which columns are sortable
	function get_sortable_columns() {
		return array(
			'name' => array('title', false),
			'views' => array('total_views', true),
			'created' => array('created_at', false),
		);
	}

	function prepare_items() {
		$screen = get_current_screen();

		$total_items = $this->playwire->getVideoCount();

		$perpage = 10;
		$paged = !empty($_GET["paged"]) ? $_GET["paged"] : '';
		if(empty($paged) || !is_numeric($paged) || $paged<=0 ){ 
			$paged = 1; 
		}
		$total_pages = ceil($total_items/$perpage);


		$orderby = isset($_GET['orderby']) ? $_GET['orderby'] : false;
		$order = isset($_GET['order']) && $_GET['order'] == 'desc' ? '_desc' : '';
		$sort_by = $orderby.$order;

		$params = $sort_by ? array('get' => array('sort' => $sort_by)) : array();

		$this->set_pagination_args(array(
			'total_items' => (double)$total_items,
			'total_pages' => $total_pages,
			'per_page' => $perpage
		));

		$columns = $this->get_columns();
		$sortable = $this->get_sortable_columns();
		$this->_column_headers = array($columns, array(), $sortable);

		$this->items = $this->playwire->getVideoIndex($perpage, $paged, $params);

		
	}

	function display_rows() {

		echo '<!-- '.print_r($this->items, true).' -->';

		if($this->tab_view) {
			echo <<<EOF
			<script type="text/javascript">
			var win = window.dialogArguments || opener || parent || top;
			var send = function(id, legacy) {
				win.send_to_editor('[' + (legacy ? 'blogvideo' : 'bolt') + ' id="' + id + '"]');
			}
			</script>
EOF;
		}

		foreach($this->items as $video) {

			echo '<tr id="video_'.$video->id.'">';
			list($columns, $hidden) = $this->get_column_info();

			foreach($columns as $column_name => $column_display_name) {
				$class = sprintf('class="%1$s column-%1$s"', $column_name);
				$style = "";
				if(in_array($column_name, $hidden)) {
					$style = ' style="display: none;"';
				}

				$attr = $class.$style;

				switch($column_name) {
					case 'cb':
						printf('<th scope="row" class="check-column"><input type="checkbox" name="linkcheck[]" value="%d" /></th>', $video->id);

						break;
					case 'thumbnail':
						
						if($video->thumb_url != '') {
							printf(
								'<td %s><a href="admin-ajax.php?action=playwire&id=%d&TB_iframe=false&width=620&height=360" class="thickbox"><img src="%s" width="100"/></a></td>',
								$attr,
								$video->id,
								$video->thumb_url
							);
						} else {
							printf(
								'<td %s>Thumbnail Unvailable</td>',
								$attr,
								$video->thumb_url
							);
						}
						
						break;
					case 'name':
						$actions = array();
						if($this->tab_view) {
							$actions['embed'] = sprintf('<a href="javascript:void(0)" onclick="send(%d)" style="color:#0a0">New Embed</a>', $video->id);
							$actions['legacyembed'] = sprintf('<a href="javascript:void(0)" onclick="send(%d, true)" style="color:#a00">Legacy Embed</a>', $video->id);
						} else {
							$actions['view'] = sprintf('<a href="admin-ajax.php?action=playwire&id=%d&TB_iframe=false&width=620&height=360" class="thickbox" onclick="">View</a>', $video->id);
							$actions['delete'] = sprintf('<a href="?page=playwire-delete&id=%d" onclick="return confirm(\'Are you sure you want to delete this video?\')">Delete Video</a>', $video->id);

						}
						
						  
						printf(
							'<td %s><strong>%s</strong>%s</td>',
							$attr,
							$video->name,
							$this->row_actions($actions)
						);
						
						break;
					case 'views':
						printf(
							'<td %s>%s</td>',
							$attr,
							$video->total_views
						);
						break;
					case 'created':
						printf(
							'<td %s>%s</td>',
							$attr,
							$video->created_at
						);
						break;
					case 'category':
						printf(
							'<td %s>%s</td>',
							$attr,
							$video->category_name
						);
						break;
				}

			}
			echo '</tr>';
		}
	}
}
?>