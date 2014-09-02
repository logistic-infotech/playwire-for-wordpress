<html>
	<head>
		<title>Playwire Video API Test - Sandbox Video Profile</title>
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

		$id = $_GET['id'];
		if ($id) {
			try {
				$video = $playwire->getSandboxVideo($id);
			} catch (PlaywireException $exception) {
				echo "Had an exception: " . $exception->getMessage();
			}
		} else
			echo "No ID provided, cannot show video.";
	}
?>
</pre>
<?php if ($video) { ?>
<div>
	<h3><?php echo $video->name; ?></h3>
</div>
<div>
	<?php echo $video->js_embed_code; ?>
</div>
<div>
	<label for="video[description]">Description:</label><br/>
	<p><?php echo $video->description; ?></p>
</div>
<div>
	<label for="video[tags]">Tags:</label>
	<p><?php echo implode(', ', $video->tags); ?></p>
</div>
<?php } ?>
</body>
</html>
