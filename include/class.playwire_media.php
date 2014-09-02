<?php

ob_start();
ini_set('max_execution_time', 0);

class playwire_media {

    protected $playwire = false;
    protected $api_key;

    function __construct($plugin) {

        $this->api_key = get_option('playwire-api-key');
        if (!empty($this->api_key)) {
            $this->playwire = new Playwire($this->api_key);
        }

        add_action('admin_init', array(&$this, 'init'));
        add_action('admin_menu', array(&$this, 'menu'));

        add_shortcode('blogvideo', array(&$this, 'embed_video'));
        add_shortcode('bolt', array(&$this, 'embed_bolt'));
        add_shortcode('cronpost', array(&$this, 'cron_post_video'));
    }

    function init() {
        register_setting('playwire', 'playwire-api-key');


        # Respond to ajax calls
        add_action('wp_ajax_playwire', array(&$this, 'view_video'));
    }

    function menu() {
        if ($this->playwire) {
            ## Main Menu
            #(page_title, menu_title, capability, menu_slug, func, icon, position)
            add_menu_page('Playwire', 'Playwire', '', 'playwire_menu', array(&$this, 'list_videos'));

            #(parent_slug, page_title, menu_title, capability, menu_slug, func)
            add_submenu_page('playwire_menu', '', 'List Videos', 'publish_posts', 'playwire-list', array(&$this, 'list_videos_wp'));
            add_submenu_page('playwire_menu', '', 'Add Video', 'publish_posts', 'playwire-add', array(&$this, 'new_video'));
            add_submenu_page('playwire_menu', '', 'Post Video', 'publish_posts', 'playwire-post-video', array(&$this, 'post_video'));
            add_submenu_page('playwire_menu', '', '', 'publish_posts', 'playwire-delete', array(&$this, 'delete_video'));
        } else {
            add_menu_page('Playwire', 'Playwire', '', 'playwire_menu', array(&$this, 'options_page'));

            #(parent_slug, page_title, menu_title, capability, menu_slug, func)
            add_submenu_page('playwire_menu', '', 'List Videos', 'publish_posts', 'playwire-list', array(&$this, 'options_page'));
            add_submenu_page('playwire_menu', '', 'Add Video', 'publish_posts', 'playwire-add', array(&$this, 'options_page'));
            add_submenu_page('playwire_menu', '', '', 'publish_posts', 'playwire-delete', array(&$this, 'options_page'));
        }



        ## Options Page
        #(page_title, menu_title, capability, slug, function)
        add_options_page('Playwire', 'Playwire', 'manage_options', 'playwire-settings', array(&$this, 'options_page'));
    }

    function options_page() {
        $missing = !is_object($this->playwire);
        include 'options.tpl.php';
    }

    function list_videos_wp() {
        $list_table = new playwire_list_table();
        $list_table->prepare_items();

        add_thickbox();
        echo '<div class="wrap nosubsub">';
        screen_icon('upload');
        echo '<h2>Playwire Videos <a href="?page=playwire-add" class="add-new-h2">Add New</a></h2>';

        $list_table->display();
        echo '</div>';
    }

    # Upload a new video to playwire

    function new_video() {
        if ($_SERVER['REQUEST_METHOD'] == 'POST') {

            $name_parts = explode('.', basename($_FILES['source']['name']));
            $filename = uniqid() . '.' . array_pop($name_parts);

            $upload = wp_upload_bits($filename, null, file_get_contents($_FILES["source"]["tmp_name"]));
            if (!$upload['error']) {
                $video = new Video();
                $video->name = $_POST['name'];
                $video->description = $_POST['description'];
                $video->category_id = $_POST['category_id'];

                //          $video->width = $_POST['width'];
                //        $video->height = $_POST['height'];
                $video->tag_list = $_POST['tag_list'];
                $video->show_video_watermark = isset($_POST['show_video_watermark']);
                $video->use_age_gate = isset($_POST['use_age_gate']);
                $video->auto_start = isset($_POST['autostart']);


                $video->source_url = $upload['url'];

                try {
                    $new_video = $this->playwire->uploadVideo($video);
                    header('Location: ?page=playwire-list');
                    exit();
                } catch (PlaywireException $exception) {
                    echo "Had an exception: " . $exception->getMessage();
                }
            }
        } else {
            $defaults = $this->playwire->getVideoDefaults();
            $categories = $this->playwire->getVideoCategories();

            include 'add.tpl.php';
        }
    }

    # get vidoe from playwire and post into website

    function post_video() {
        if ($_SERVER['REQUEST_METHOD'] == 'POST') {

            $sqlfetchDT = "select * from wp_playwire_cron_config";
            $resfetchDT = mysql_query($sqlfetchDT);
            $playwireConfigCheckData = mysql_fetch_assoc($resfetchDT);
            //print_r($playwireConfigCheckData);
            if (empty($playwireConfigCheckData)) {
                $qryIns = "insert into wp_playwire_cron_config(playwireCat,sitePostCat) values('{$_REQUEST["category_id"]}','{$_REQUEST["post_category_id"]}')";
                //echo $qryIns;
                mysql_query($qryIns);
            } else {
                $qryUpdate = "update wp_playwire_cron_config set playwireCat='{$_REQUEST["category_id"]}',sitePostCat='{$_REQUEST["post_category_id"]}' ";
                mysql_query($qryUpdate);
            }
            header('Location: ?page=playwire-post-video&message=1');
        } else {
            $categories = $this->playwire->getVideoCategories();
            $catargs = array(
                'type' => 'post',
                'child_of' => 0,
                'parent' => '',
                'orderby' => 'name',
                'order' => 'ASC',
                'hide_empty' => 1,
                'hierarchical' => 1,
                'exclude' => '',
                'include' => '',
                'number' => '',
                'taxonomy' => 'category',
                'pad_counts' => false
            );
            $postCategories = get_categories($catargs);
            //print_r($postCategories);
            $sqlSelQuery = "select * from wp_playwire_cron_config";
            $res = mysql_query($sqlSelQuery);
            $playwireConfigData = mysql_fetch_assoc($res);
//            echo "<pre>";
//            print_r($playwireConfigData);
//            echo "</pre>";
            include 'postVideo.tpl.php';
        }
    }

    function cron_post_video() {
        try {
            $getFromSandBox = true;
            $category_id = 27;
            $post_category_id = 2;
            $params = array('get' => array('category_id' => $category_id, 'count' => 2));
            $count = 0;
            $page = 0;
            if ($getFromSandBox)
                $post_video = $this->playwire->getVideoSandboxIndex($count, $page, $params);
            else
                $post_video = $this->playwire->getVideoIndex($count, $page, $params);

            foreach ($post_video as $video) {
                if ($getFromSandBox) {
                    $embedVideo = '[bolt id="' . $video->id . '" sandbox= "true"]';
                } else {
                    $embedVideo = '[bolt id="' . $video->id . '"]';
                }
                $my_post = array(
                    'post_title' => wp_strip_all_tags($video->name),
                    'post_content' => $embedVideo . $video->tdescription,
                    'post_status' => 'publish',
                    'post_author' => 1,
                    'post_category' => array($post_category_id)
                );
                // Insert the post into the database
                wp_insert_post($my_post);
                exit();
            }
        } catch (PlaywireException $exception) {
            echo "Had an exception: " . $exception->getMessage();
        }
    }

    # View a single video

    function view_video() {
        $sandbox = isset($_GET['sandbox']) && $_GET['sandbox'] == 1;
        $id = $_GET['id'];

        $video = ($sandbox) ? $this->playwire->getSandboxVideo($id) : $this->playwire->getVideo($id);
        include 'view.tpl.php';
        exit();
    }

    # Delete a single video

    function delete_video() {
        $error = false;
        try {
            $this->playwire->deleteVideo($_GET['id']);
            header('Location: ?page=playwire-list');
            exit();
        } catch (PlaywireException $exception) {
            $error = $exception->getMessage();
        }
    }

    # Embed the video via HTML
    # Used via short codes in a post

    function embed_video($id, $sandbox = false) {
        $id = $id['id'];
        $video = ($sandbox) ? $this->playwire->getSandboxVideo($id) : $this->playwire->getVideo($id);

        echo $video->js_embed_code;
    }

    function your_css_and_js() {
        
        wp_register_script('your_css_and_js', plugins_url('http://192.168.0.3/wp391/wp-content/plugins/playwire-for-wordpress-master/js/embed.min.js', __FILE__));
        
    }

    function embed_bolt($id, $sandbox = false) {
        add_action( 'admin_init','your_css_and_js');
        $id = $id['id'];
        if (isset($id['sandbox'])) {
            $sandbox = $id['sandbox'];
        } else {
            $sandbox = $sandbox;
        }
        $sandbox = "true";
        $video = $sandbox ? $this->playwire->getSandboxVideo($id) : $this->playwire->getVideo($id);
        //echo $video->signed_mp4;
              //echo "<pre>";
              //print_r($video->json_embed_code);
              //echo "RAAAAAAAAAAAA";
$video->json_embed_code=str_replace("//cdn.playwire.com/bolt/js/embed.min.js","http://192.168.0.79/wp391/wp-content/plugins/playwire-for-wordpress-master/js/embed.min.js",$video->json_embed_code);
$video->json_embed_code=  str_replace('http://cdn.playwire.com/bolt/swf/bolt.swf', 'http://192.168.0.79/wp391/wp-content/plugins/playwire-for-wordpress-master/swf/bolt.swf', $video->json_embed_code);
echo "<div class='playwire-video-content'>".$video->json_embed_code."</div>";
        //echo '<iframe name="vid" width=425 height=350 src="'.$video->signed_mp4.'"></iframe>';
        //echo $video->signed_mp4;
        //echo do_shortcode("[hana-flv-player video='.$video->signed_mp4.' autoplay='true']");  
        //echo do_shortcode("[videojs mp4='.$video->signed_mp4.' autoplay='true']");  
        //echo do_shortcode("[video mp4='.$video->signed_mp4.' autoplay='true'  preload='false']");  
        //echo do_shortcode("[fvplayer src='.$video->signed_mp4.' autoplay='true']");  
        //echo '[jwplayer config="" file="'.$video->signed_mp4.'" autostart="true"]';  
        // echo do_shortcode('[jwplayer config="" file="'.$video->signed_mp4.'" width="300px" height="300px" autostart="true" primary="html5"]');  
    //wp_register_script( 'sitescript',   'http://192.168.0.3/wp391/wp-content/plugins/playwire-for-wordpress-master/js/sitescript.js');
      wp_enqueue_script( 'http://192.168.0.79/wp391/wp-content/plugins/playwire-for-wordpress-master/js/bolt.min.js' );
       wp_enqueue_script( 'http://192.168.0.79/wp391/wp-content/plugins/playwire-for-wordpress-master/js/bolt_html5.js' );
        //wp_enqueue_script( 'http://192.168.0.3/wp391/wp-content/plugins/playwire-for-wordpress-master/js/sitescript.js' );


       // echo apply_filters('the_content', '[jwplayer config="" file="' .$video->signed_mp4. '" width="300px" height="300px" autostart="true" primary="html5"]');
    }

//     function cron_post_video($id, $sandbox = false){
//         
//          $my_post = array(
//                        "post_title' => 'test for shotrt fsdf',
//                        'post_content' => "fsdfds short code post content",
//                        'post_status' => 'publish',
//                        'post_author' => 1,
//                        'post_category' => array(2)
//                    );
//                    // Insert the post into the database
//                    wp_insert_post($my_post);
//         
//     }
}
?>