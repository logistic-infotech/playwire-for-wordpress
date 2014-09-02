<html>
	<head>
		<title>Playwire Video API Test - Video Details</title>
	</head>
<body>
<pre>
<?php 
	require_once('include/common.php');
	if (empty($api_token)) {
		showAPITokenForm();
	} else {
		require_once('include/class.playwire.php');

		$playwire = new Playwire($api_token);

		$is_post = $_POST['is_post'];
		if ($is_post) {
			echo "<pre>";
			// This is a POST, call the API
			$video = new Video();
			$video->id = $_POST['id'];
			$video->name = $_POST['name'];
			$video->description = $_POST['description'];
			$video->category_id = $_POST['category_id'];
			$video->width = $_POST['width'];
			$video->height = $_POST['height'];
			$video->tag_list = $_POST['tag_list'];
			$video->show_video_watermark = checkboxValue($_POST['show_video_watermark']);
			$video->use_age_gate = checkboxValue($_POST['use_age_gate']);
			$video->auto_start = checkboxValue($_POST['auto_start']);
			$message = "";
			try {
				$video = $playwire->updateVideo($video);
				$message = "Successfully updated video.";
				$categories = $playwire->getVideoCategories();
			} catch (PlaywireException $exception) {
				echo "Had an exception: " . $exception->getMessage();
				if ($exception->getCode() == PLAYWIRE_ERROR_FIELD_ERRORS) {
					echo "\n\nField errors exception, first error field is " . $exception->field_errors[0]['field'] . " with message " . $exception->field_errors[0]['message'];
				}
				$video = null;
			}
			echo "</pre>";
		}
		else {

			$id = $_GET['id'];
			if ($id) {
				try {
					$video = $playwire->getVideo($id);
					$categories = $playwire->getVideoCategories();
				} catch (PlaywireException $exception) {
					echo "Had an exception: " . $exception->getMessage();
				}
			}
		}
	}
	?>
	</pre>
	<?php if ($video) { ?>
	<table width="90%" cellpading="1" cellspacing="1" border="0" style="padding-left:13px;">
	<tr><td colspan="2" align="center"><?php if(!empty($message)) echo $message; ?></td></tr>
	<form method="post" action="">
	<input type="hidden" name="is_post" value="1"/>
	<input type="hidden" name="id" value="<?php echo $video->id; ?>"/>
	<tr>
		<td width="15%"><label for="name">Name:</label></td>
		<td><input type="text" name="name" size="77" value="<?php echo $video->name; ?>"/></td>
	</tr>
	<tr><td colspan="2">&nbsp;</td></tr>
	<tr>
		<td>&nbsp;</td>
		<td><div>
			<?php 
				if ($video->status == 'encoding')
					echo "Video is still encoding.";
				else
					echo $video->js_embed_code;
			?>
		</div>
		<div>&nbsp;</div>
		</td>
	</tr>
	<tr><td colspan="2">&nbsp;</td></tr>
	<tr>
		<td width="15%" valign="top"><label for="description">Description:</label></td>
		<td><textarea name="description" rows="6" cols="75"><?php echo $video->description; ?></textarea></td>
	</tr>
	<tr>
		<td width="15%"><label for="category_id">Category:</label></td>
		<td><select name="category_id">
			<option value="">Select Category</option>
			<?php
				foreach($categories as $category) {
					echo '<option value="' . $category->id . '"';
					if (intval($category->id) == intval($video->category_id))
						echo 'selected="selected"';
					echo '>' . $category->name . '</option>'; 
				}
			?>
		</select></td>
	</tr>
	<tr>
		<td width="15%"><label for="width">Width:</label></td>
		<td><input type="text" name="width" size="5" value="<?php echo $video->width; ?>"/></td>
	</tr>
	<tr>
		<td width="15%"><label for="height">Height:</label></td>
		<td><input type="text" name="height" size="5" value="<?php echo $video->height; ?>"/></td>
	</tr>
	<tr>
		<td width="15%"><label for="tags">Tags:</label></td>
		<td><input type="text" name="tag_list" size="80" value="<?php echo $video->tag_list; ?>"/></td>
	</tr>
	<tr>
		<td>&nbsp;</td><td><h4>Video Settings</h4></td>
	</tr>
	<tr>
		<td>&nbsp;</td><td><div>
		<input type="checkbox" name="show_video_watermark" value="on" <?php if ($video->show_video_watermark) echo "checked=\"checked\""; ?>/>
			<label for="show_video_watermark">Show Video Watermark</label>
		</div>
		<div>
			<input type="checkbox" name="use_age_gate" value="on" <?php if ($video->use_age_gate) echo "checked=\"checked\""; ?>/>
			<label for="use_age_gate">Use Age Gate</label>
		</div>
		<div>
			<input type="checkbox" name="auto_start" value="on" <?php if ($video->auto_start) echo "checked=\"checked\""; ?>/>
			<label for="auto_start">Auto Play</label>
		</div></td>
	</tr>
	<tr><td colspan="2">&nbsp;</td></tr>
	<tr>
		<td>&nbsp;</td>
		<td>Aspect Ratio: <?php echo $video->aspect_ratio; ?><br/>
		Status: <?php echo $video->status; ?><br/>
		<!--Uploaded on <?php echo date_format($video->created_at, "F j, Y g:i A"); ?><br/>-->
		Uploaded on <?php echo $video->created_at; ?><br/>
		Total Views: <?php echo $video->total_views; ?><br/>
		Total Bandwidth: <?php echo $video->total_bandwidth; ?> MB<br/></td>
	</tr>
	<tr><td colspan="2">&nbsp;</td></tr>
	<tr>
		<td>&nbsp;</td><td><input type="submit"/ name="Submit" value="Update"></td>
	</tr>
	</table>
	<?php } ?>
</body>
</html>