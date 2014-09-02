<div class="wrap">
<? screen_icon('options-general') ?>
<h2>Playwire Settings</h2>

<form method="post" action="options.php">
<?
settings_fields('playwire');
$api_key = get_option('playwire-api-key');
?>
<? if($missing): ?>
<h3>Your API Key is required to use the playwire plugin</h3>
<? endif ?>


<table class="form-table">
	<tr valign="top">
		<th scope="row"><label for="playwire-api-key">API Key</label></th>
		<td>
		<input name="playwire-api-key" type="text" id="playwire-api-key" value="<?= $api_key?>" class="regular-text" />
		<span class="description">The API key from Playwire.com</span>
		</td>
	</tr>
	</td>
	</tr>
</table>

<? submit_button( 'Save Changes', 'primary', 'submit');?>
</form>
</div>