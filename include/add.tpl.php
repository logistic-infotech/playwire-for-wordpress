<div class="wrap">
<? screen_icon('upload') ?>
<h2>Upload a New Playwire Video</h2>

<form method="post" enctype="multipart/form-data">


<table class="form-table">
	<tr valign="top">
		<th scope="row"><label for="name">Video Name</label></th>
		<td>
			<input name="name" type="text" id="name" class="regular-text" />
		</td>
	</tr>

	<tr valign="top">
		<th scope="row"><label for="source_url">Source File</label></th>
		<td>
			
			<input type="file" name="source" id="source" class="regular-text" />
		</td>
	</tr>

	<tr valign="top">
		<th scope="row"><label for="description">Description</label></th>
		<td>
			<textarea name="description" rows="10" cols="50" id="description" class="regular-text"></textarea>
		</td>
	</tr>

	<tr valign="top">
		<th scope="row"><label for="category_id">Category</label></th>
		<td>
			<select name="category_id" id="category_id" class="regular-text">
				<? foreach($categories as $category): ?>
					<option value="<?= $category->id ?>"><?= $category->name ?></option>
				<? endforeach ?>
			</select>
		</td>
	</tr>

	<tr valign="top">
		<th scope="row"><label for="width">Width</label></th>
		<td>
			<input name="width" type="text" id="width" class="regular-text" />
		</td>
	</tr>

	<tr valign="top">
		<th scope="row"><label for="height">Height</label></th>
		<td>
			<input name="height" type="text" id="height" class="regular-text" />
		</td>
	</tr>

	<tr valign="top">
		<th scope="row"><label for="tags">Tags</label></th>
		<td>
			<input name="tags" type="text" id="tags" class="regular-text" />
		</td>
	</tr>

	<tr valign="top">
		<th scope="row"><label for="tags">Video Settings</label></th>
		<td>
			<label for="show_video_watermark">
				<input type="checkbox" name="show_video_watermark" id="show_video_watermark" value="on" <? if($defaults->show_video_watermark): ?>checked="checked"<? endif ?> />
				Show Video Watermark
			</label><br />

			<label for="use_age_gate">
				<input type="checkbox" name="use_age_gate" id="use_age_gate" value="on" <? if($defaults->use_age_gate): ?>checked="checked"<? endif ?> />
				Use Age Gate
			</label><br />

			<label for="auto_start">
				<input type="checkbox" name="auto_start" id="auto_start" value="on" <? if($defaults->auto_start): ?>checked="checked"<? endif ?> />
				Auto Play
			</label><br />
		</td>
	</tr>

</table>
<? submit_button( 'Upload Video', 'primary', 'submit');?>
</form>
</div>