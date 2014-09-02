<div class="wrap">
<? screen_icon('upload') ?>
<?php if (isset($_REQUEST['message']) &&  $_REQUEST['message']) { ?>
<div id="message" class="updated">
<p><?php printf( __( 'Config Data updated successfully.' )); ?></p>
</div>
<?php } ?>
<h2>Playwire Cron Config Post</h2>

<form method="post" enctype="multipart/form-data" id="post-playwire-video" name="post-playwire-video">
<table class="form-table">
	<tr valign="top">
        <th scope="row"><label for="category_id">Playwire Category <p style="font-size: 10px;margin: 0;">(Video will get from this category) </p></label></th>
		<td>
			<select name="category_id" id="category_id" class="regular-text">
				<? foreach($categories as $category): ?>
					<option value="<?= $category->id ?>"  <?= ($category->id==$playwireConfigData['playwireCat'])?'selected':'' ?>><?= $category->name ?></option>
				<? endforeach ?>
			</select>
           
		</td>
	</tr>
    <tr valign="top">
        <th scope="row"><label for="post_category_id">Post Category <p style="font-size: 10px;margin: 0;">(Video will post in this category) </p></label></th>
		<td>
			<select name="post_category_id" id="post_category_id" class="regular-text">
				<? foreach($postCategories as $category): ?>
					<option value="<?= $category->cat_ID ?>" <?= ($category->cat_ID==$playwireConfigData['sitePostCat'])?'selected':'' ?>><?= $category->name ?></option>
				<? endforeach ?>
			</select>
           
		</td>
	</tr>
     
</table>
    <div style="float: left;margin-top: 20px;">
<?  submit_button( 'Save', 'primary', 'submit' , false);?>
    </div> <span class="spinner" style="float: left;margin:25px 5px 0"></span>
</form>
</div>
<script>
   jQuery(document).ready(function(){
        jQuery('form#post-playwire-video').live('submit', function( event ) {
        if ( jQuery("#submit").hasClass('disabled') ) {
            console.log("form  ruen submiteed");
			event.preventDefault();
			return;
		}
        jQuery("#post-playwire-video .spinner").show();
        jQuery("#submit").addClass( 'disabled' );
        jQuery("#submit").attr( 'disabled','true' );
        return true;
		});
   });
</script>