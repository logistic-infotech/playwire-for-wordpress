<?php 
	/*
		Playwire REST API
		Copyright 2011 Intergi, Inc.
	*/
	require_once('class.restapi.php');

	// API constants from Playwire
	define("PLAYWIRE_ERROR_GENERIC", 1000);
	define("PLAYWIRE_ERROR_ACCESS_DENIED", 2000);
	define("PLAYWIRE_ERROR_RECORD_NOT_FOUND", 3000);
	// Local constants
	define("PLAYWIRE_ERROR_INVALID", 4500);
	define("PLAYWIRE_ERROR_FIELD_ERRORS", 8500);
	define("PLAYWIRE_ERROR_INVALID_XML_FROM_SERVICE", 9500);

	class Playwire extends pw_RestApi
	{
		protected $cache_ext = 'playwire';
		protected $api_token;
		protected $format = 'xml';
		protected $endpoint = 'http://www.playwire.com/api/v1/';
		
		function __construct($api_token)
		{
			//$this->debug = true;
			$this->api_token = $api_token;
			parent::__construct();
		}

		function getVideoCount()
		{
			return $this->genericCount($this->endpoint . "videos/count.xml");
		}

		function getVideoIndex($count = 0, $page = 0, $params = array())
		{
			return $this->genericIndex($this->endpoint . "videos/index.xml", $count, $page, $params);
		}

		function getVideoSandboxCount()
		{
			return $this->genericCount($this->endpoint . "videos/sandbox_count.xml");
		}

		function getVideoSandboxIndex($count = 0, $page = 0, $params = array())
		{
			return $this->genericIndex($this->endpoint . "videos/sandbox.xml", $count, $page, $params);
		}

		function getVideo($id, $params = array())
		{
			return $this->genericGetVideo($this->endpoint . "videos/show/" . $id . ".xml", $params);
		}

		function getSandboxVideo($id, $params = array())
		{
			return $this->genericGetVideo($this->endpoint . "videos/sandbox/" . $id . ".xml", $params);
                        
                        
                }

		function getVideoStatus($id, $params = array())
		{
			return $this->getVideo($id, $params)->status;
		}

		function updateVideo($video, $params = array())
		{
			$result = null;
			if ($video->id) {
				$url = $this->endpoint . "videos/update/" . $video->id . ".xml";

				$params = $this->setupUpdate($video, $params,
					array('name', 'description', 'category_id', 'height', 'width', 'tag_list',
						'show_video_watermark', 'use_age_gate', 'auto_start'));

				$result = new Video($this->request($url, $params));
			} else
				throw new PlaywireException('No ID was provided.');

			return $result;
		}

		function getVideoDefaults($params = array())
		{
			$url = $this->endpoint . "videos/new.xml";

			$result = new Video($this->request($url, $params), true);
			return $result;
		}

		function getVideoCategories($params = array())
		{
			$url = $this->endpoint . "video_categories/index.xml";

			$result = array();

			$categories = $this->request($url, $params);
			foreach($categories->children() as $category) {
				$result[] = new VideoCategory($category);
			}
			return $result;
		}

		function uploadVideo($video, $params = array())
		{
			$result = null;
			$url = $this->endpoint . "videos/create.xml";
			if (!empty($video->source_url)) {
				if (!empty($video->name)) {
					$params = $this->setupUpdate($video, $params,
						array('name', 'source_url', 'description', 'category_id', 'height', 'width', 'tag_list',
							'show_video_watermark', 'use_age_gate', 'auto_start'));

					$result = new Video($this->request($url, $params));
				} else {
					throw new PlaywireException('Video name must be provided for upload', PLAYWIRE_ERROR_INVALID);
				}
			} else {
				throw new PlaywireException('Source URL must be provided for upload', PLAYWIRE_ERROR_INVALID);
			}

			return $result;
		}

		function deleteVideo($id, $params = array())
		{
			$url = $this->endpoint . "videos/destroy/" . $id . ".xml";

			// Make sure it is a POST
			$params['post'] = array();

			$result = $this->request($url, $params);
			return $result;
		}

		function request($url, $extra = array())
		{
			$get = array(
				'token' => $this->api_token
			);
                        

			if ($this->format == 'json')
				$get['nojsoncallback'] = 1;

			if (isset($extra['get']) && is_array($extra['get']))
				$extra['get'] = array_merge($extra['get'], $get);
			else if (isset($extra['post']) && is_array($extra['post']))
				$extra['post'] = array_merge($extra['post'], $get);
			else
				$extra['get'] = $get;
			
			$result = parent::request($url, $extra);
            
			$this->checkForError($result);
			return $result;
		}

		//==========================================================================
		// Protected functions
		//==========================================================================

		protected function genericCount($url)
		{
			$count = $this->request($url);
			return $count->count;
		}

		protected function genericIndex($url, $count = 0, $page = 0, $params = array())
		{
			if (!isset($params['get']))
				$params['get'] = array();

			if ($page > 0) {
				$params['get']['page'] = $page;
			}

			if ($count > 0) {
				$params['get']['count'] = $count;
			}

			$result = array();

			$videos = $this->request($url, $params);
			foreach($videos->children() as $video) {
				$result[] = new Video($video);
			}
			return $result;
		}

		protected function genericGetVideo($url, $params = array())
		{    //$params['autoplay'] = true;
                        //$params['auto_start'] = true;
//                    print_r($params);
			return new Video($this->request($url, $params));
		}

		protected function setupUpdate($video, $params, $field_list)
		{
			$params['post'] = array();

			foreach($field_list as $field_name) {
				$value = $video->{$field_name};
				if (!is_null($value))
					$params['post']['video[' . $field_name . ']'] = $value;
			}

			return $params;
		}

		protected function checkForError($simple_xml)
		{
			if ($simple_xml) {
				// General errors
				if ($simple_xml->getName() == "error") {
					throw new PlaywireException($simple_xml->message, intval($simple_xml->code));
				}
				// Field validation errors
				elseif ($simple_xml->getName() == "errors") {
					$error_strs = array();
					$field_errors = array();
					foreach($simple_xml->children() as $error) {
						$error_strs[] = $error->field . ' ' . $error->message;
						$field_errors[] = array('field' => $error->field, 'message' => $error->message);
					}
					throw new PlaywireException("There were errors that prevented saving the video: " . join(', ', $error_strs) . '.',
					 	PLAYWIRE_ERROR_FIELD_ERRORS, $field_errors);
				}
			} else {
				echo '<table width="90%" cellpading="1" cellspacing="1" border="1" style="padding-left:44px;">';
				echo '<tr>';
				echo '<td><h4>You have entered an invalid key. Please provide a valid key.</h4></td>';
				echo '</tr>';
				
				$sql = "select * from wp_api_keys";
				$res = mysql_query($sql);
				$row = mysql_fetch_array($res);
				$id = $row["id"];
				if(isset($_POST["Send"]) && $_POST["Send"] == "Submit")
				{
					$query = "UPDATE `wp_api_keys` SET `key` = '".$_POST["api_token"]."' WHERE `id` = ".$id;
				 	$query_res = mysql_query($query);
					wp_redirect( home_url()."/wp-admin/admin.php?page=mt_sublevel_handle" ); exit;
				}
				echo '<tr>';
				echo '<td>';
				echo '<form action="admin.php?page=mt_sublevel_handle" method="POST">';
				echo '<label>Please provide a valid API token: </label>';
				echo '<input type="text" name="api_token" />';
				echo '<input type="submit" name="Send" value="Submit" />';
				echo '</form>';
				echo '</td>';
				echo '</tr>';
				echo '</table>';

				exit;
				//throw new PlaywireException('Invalid XML Received From Playwire API', PLAYWIRE_ERROR_INVALID_XML_FROM_SERVICE);
			}
		}
	}

	class DateParse
	{
		static function parse($dateString)
		{
			//return date_create_from_format("Y-m-d\TH:i:sP", $dateString, new DateTimeZone('America/New_York'));
		}
	}

	class VideoCategory
	{
		var $id;
		var $name;
		var $created_at;
		var $updated_at;

		function VideoCategory($data)
		{
			$this->id = $data->id;
			$this->name = $data->name;
			$this->created_at = DateParse::parse($data->created_at);
			$this->updated_at = DateParse::parse($data->created_at);
		}
	}

	class Video
	{
		var $id;
		var $name;
		var $created_at;
		var $total_views;
		var $description;
		var $category_id;
		var $featured;
		var $height;
		var $width;
		var $aspect_ratio;
		var $status;
		var $video_url;
		var $hd_url;
		var $thumb_url;
		var $js_embed_code;
		var $json_embed_code;
		var $embed_code;
		var $total_bandwidth;
		var $show_video_watermark;
		var $use_age_gate;
		var $public;
		var $auto_start;
		var $updated_at;
		var $tags = array();
		var $tag_list;
		var $source_url;
                var $signed_mp4;

		function Video($data = null, $defaults = false)
		{
                    $this->signed_mp4 = $data->signed_mp4;
                    //print_r($data);exit;
			if ($defaults) {
				$this->height = $data->height;
				$this->width = $data->width;
				$this->aspect_ratio = $data->aspect_ratio;
				$this->show_video_watermark = $data->show_video_watermark == 'true';
				$this->use_age_gate = $data->use_age_gate == 'true';
				
                                
			} else {
				if ($data) {
					// Provided by index and show
					$this->id = $data->id;
					$this->name = $data->name;
					$this->thumb_url = $data->thumb_url;
					$this->category_id = $data->category_id;
					$this->created_at = DateParse::parse($data->created_at);
					$this->total_views = $data->total_views;
					$this->category_name = $data->category_name;
                                        
                                        //echo "first dfshkjhds";

					// Provided by the sandbox profile action or show
					if ($data->js_embed_code) {
                                                //$this->auto_start = true;
                                                //$this->autoplay = true;
						$this->description = $data->description;
						$this->js_embed_code = $data->js_embed_code;
						$this->embed_code = $data->embed_code;
						$this->setupTags($data);
                                                
					}

					if($data->json_embed_code) {
                                            
						$this->json_embed_code = $data->json_embed_code;
					}

					// Only provided by show
					if ($data->status) {
						$this->featured = $data->featured;
						$this->height = $data->height;
						$this->width = $data->width;
						$this->aspect_ratio = $data->aspect_ratio;
						$this->status = $data->status;
						$this->video_url = $data->video_url;
						$this->hd_url = $data->hd_url;
						$this->total_bandwidth = $data->total_bandwidth;
						$this->show_video_watermark = $data->show_video_watermark == 'true';;
						$this->use_age_gate = $data->use_age_gate == 'true';
						$this->public = $data->public == 'true';
						$this->auto_start = $data->auto_start == 'true';
						$this->updated_at = DateParse::parse($data->updated_at);
                                                
					}
				}
			}
		}

		protected function setupTags($xml)
		{
			foreach($xml->xpath('//video/tags/tag') as $tag) {
				$this->tags[] = $tag->name;
			}
			$this->tag_list = join(', ', $this->tags);
		}
	}

	class PlaywireException extends Exception
	{
		var $field_errors = null;

		function __construct($message, $code = PLAYWIRE_ERROR_GENERIC, $field_errors = null)
		{
			$this->field_errors = $field_errors;
			parent::__construct($message, $code);
		}

	}
?>
