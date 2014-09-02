<?php
ini_set('max_execution_time', 0);
require_once 'include/class.playwire.php';
require_once '../../../wp-blog-header.php';
require_once ('../../../wp-includes/post.php');
//$link=mysql_connect("localhost","root","root");
//mysql_select_db("wp391");
$qry="select * from wp_api_keys";
$res=mysql_query($qry);
$row=mysql_fetch_assoc($res);
$qrypost="select * from wp_playwire_cron_config";
$respost=  mysql_query($qrypost);
$rowpost=  mysql_fetch_assoc($respost);
//echo "<pre>";
//print_r($rowpost);
//echo "</pre>";
//exit();
//print_r($row);
$api_token = $row['key'];
$playwire = new Playwire($api_token);

try {
                $getFromSandBox = true;
                $category_id = $rowpost["playwireCat"];
                $post_category_id = $rowpost["sitePostCat"];
                $params = array('get' => array('category_id' => $category_id ,'count'=>2));
                $count = 0;
                $page = 0;
                if($getFromSandBox)
                    
                    $post_video = $playwire->getVideoSandboxIndex($count, $page, $params);
                else 
                    $post_video = $playwire->getVideoIndex($count, $page, $params);
                
                foreach ($post_video as $video) {
                    
                    if($getFromSandBox){
                        $embedVideo  = '[bolt id="'.$video->id.'" sandbox= "true"]';}
                    else{
                        $embedVideo  = '[bolt id="'.$video->id.'"]';}
                        $my_post = array(
                        'post_title' => wp_strip_all_tags($video->name),
                        'post_content' => $embedVideo.$video->tdescription,
                        'post_status' => 'publish',
                        'post_author' => 1,
                        'post_category' => array($post_category_id)
                    );
                    // Insert the post into the database
                     wp_insert_post($my_post);
                    //exit();
//                        echo "<pre>";
//                        print_r($video);
//                        echo "</pre>";
                    }
                    
            } catch (PlaywireException $exception) {
                echo "Had an exception: " . $exception->getMessage();
            }
?>
