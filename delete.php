<html>
	<head>
		<title>Playwire Video API Test - Video Delete</title>
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
				$playwire->deleteVideo($id);
				echo "<div style='padding-top:10px; text-align:center; font-weight:bold; font-size:14px;'>Successfully deleted video with id " . $id."</div>";
				//wp_redirect(home_url().'/wp-admin/admin.php?page=mt_sublevel_handel'); exit;
			} catch (PlaywireException $exception) {
				echo "Had an exception: " . $exception->getMessage();
			}
		} else
			echo "Error: No video ID provided.";
	}
?>
</pre>
</body>
</html>
