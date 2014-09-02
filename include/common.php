<?php
function checkboxValue($value) {
    if (!empty($value) && $value == 'on')
        return '1';
    else
        return '0';
}

function showAPITokenForm() { 

	$table = "wp_api_keys";
	$db = DB_NAME;
	
	if(isset($_POST["Submit"]) && $_POST["Submit"] == "Submit")
	{
		$query = "INSERT INTO `wp_api_keys` (`key`) VALUES ('".$_POST["api_token"]."')";
	 	$query_res = mysql_query($query);
	}
	
	if (table_exists($table, $db)) { 
		
		$sql = "select count(*) as numCount from wp_api_keys";
		$res = mysql_query($sql);
		$row = mysql_fetch_array($res);
		if($row["numCount"] >= 1)
		{ 
			$sqlQuery = "select * from wp_api_keys";
			$queryRes = mysql_query($sqlQuery);
			$APIRes = mysql_fetch_array($queryRes);	
			$api_token = $APIRes["key"];
			return $api_token;	

		} else {
			echo '<form action="admin.php?page=mt_sublevel_handle" method="POST">';
			echo '<label>Please provide an API token: </label>';
			echo '<input type="text" name="api_token" />';
			echo '<input type="submit" name="Submit" value="Submit" />';
			echo '</form>';
		}
		
		exit;	
	} else { 
		$query = "CREATE TABLE `wp_api_keys` (`id` INT NOT NULL AUTO_INCREMENT ,`key` VARCHAR( 255 ) NOT NULL ,PRIMARY KEY ( `id` ))";
		$query_res = mysql_query($query);
		
		echo '<form action="admin.php?page=mt_sublevel_handle" method="POST">';
		echo '<label>Please provide an API token: </label>';
		echo '<input type="text" name="api_token" />';
		echo '<input type="submit" name="Submit" value="Submit" />';
		echo '</form>';
		exit;
	}

}

function table_exists ($table, $db) { 
	$tables = mysql_list_tables ($db); 
	while (list ($temp) = mysql_fetch_array ($tables)) {
		if ($temp == $table) {
			return TRUE;
		}
	}
	return FALSE;
}

$api_token = showAPITokenForm();
?>
