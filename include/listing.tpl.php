<?
function pagination_link($sandbox, $count, $page) {

	$r = sprintf(
		'<li><a href="?page=%1$s&count=%2$d&pagenum=%3$d&sandbox=%4$d">%3$d</a></li>',
		'playwire-list',
		$count,
		$page,
		$sandbox
		);
	return $r;
}
?>

<style>
.videoBox {
	height: 250px;
}
.videoBox img {
	width: 200px;
}
</style>
<h3 style="padding-left:44px;">
<?php echo ($sandbox) ? 'Sandbox' : 'My Videos' ?> for token <?php echo $api_key ?>
</h3>
<h4 style="padding-left:44px;">If you would like any of these videos to be displayed on your blog post, please copy the short code of the particular video (e.g. [bolt id="12345"]) from the listing below and paste it in the blog post.</h4>
<a href="?page=playwire-add" style="padding-left:44px;">Add New Video</a>

<h4 style='padding-left:44px;'>Total videos is <?=$total_videos?></h4>
<h4 style='padding-left:44px;'>Videos per page:
<? for($per_page = 10; $per_page <= 50; $per_page+=10): ?>
	<? if($per_page == $count): ?>
		<?= $per_page ?> 
	<? else: ?>
		<a href="?page=playwire-list&count=<?= $per_page ?>"><?= $per_page ?></a>
	<? endif ?>
<? endfor ?>
</h4>

<div class="videos">
	<div class="header">
		<h4>Sort By:</h4>
		<ul>
			
			<li>
				<? if($sort_by == 'created_at'): ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=create_at_desc">
						Date Created
						<img src="<?= bloginfo('url') ?>/wp-content/plugins/playwire_wp/images/green_down_arrow.jpg" style="margin:0 3px;"/>
					</a>
				<? else: if($sort_by=='create_at_desc'): ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=create_at">
						Date Created
						<img src="<?= bloginfo('url') ?>/wp-content/plugins/playwire_wp/images/green_top_arrow.jpg" style="margin:0 3px;"/>
					</a>
				<? else: ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=created_at">
						Date Created
					</a>
				<? endif; endif; ?>
			</li>
			<li>
				<? if($sort_by == 'title'): ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=title_desc">
						Title
						<img src="<?= bloginfo('url') ?>/wp-content/plugins/playwire_wp/images/green_down_arrow.jpg" style="margin:0 3px;"/>
					</a>
				<? else: if($sort_by=='title_desc'): ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=title">
						Title
						<img src="<?= bloginfo('url') ?>/wp-content/plugins/playwire_wp/images/green_top_arrow.jpg" style="margin:0 3px;"/>
					</a>
				<? else: ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=title">
						Title
					</a>
				<? endif; endif; ?>
			</li>
			<li>
				<? if($sort_by == 'total_views'): ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=total_views_desc">
						Views
						<img src="<?= bloginfo('url') ?>/wp-content/plugins/playwire_wp/images/green_down_arrow.jpg" style="margin:0 3px;"/>
					</a>
				<? else: if($sort_by=='total_views_desc'): ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=total_views">
						Views
						<img src="<?= bloginfo('url') ?>/wp-content/plugins/playwire_wp/images/green_top_arrow.jpg" style="margin:0 3px;"/>
					</a>
				<? else: ?>
					<a href="?page=playwire-list&sandbox=<?=$sandbox?>&sort=total_views">
						Views
					</a>
				<? endif; endif; ?>
			</li>
		</ul>
	</div>

	<div class="video_page">
		<ul>
			<? foreach($videos as $video): ?>
				<li>
					<div class="videoBoxOuter">
						<div class="videoBox">
							<p>
								<a href="?page=playwire-view&id=<?= $video->id ?>&sandbox=<?= $sandbox ?>">
									<img src="<?= $video->thumb_url ?>" />
								</a>
							</p>
							<h4><?= $video->name ?></h4>
							<p class="view"><strong>Views: </strong><?= $video->total_views ?></p><br />
							<p class="date"><strong>Date Created:</strong><?= $video->created_at?></p><br />
							<p class="category"><strong>Category:</strong><?= $video->category_name ?></p><br />
							<p class="category"><strong>Short Code:</strong>[bolt id="<?= $video->id ?>" <? if($sandbox) :?>is_sandbox="1"<? endif ?>]</p>
						</div>
						<div class="videoLinks">
							<a href="?page=playwire-view&id=<?= $video->id ?>&sandbox=<?= $sandbox ?>">View Video</a>
							<a href="?page=playwire-delete&id=<?= $video->id ?>" onclick="return confirm('Are you sure you want to delete this video?')">Delete Video</a>
						</div>
					</div>
				</li>
			<? endforeach?>
		</ul>
	</div>
	<div class="video_pageingfront">
		<ul>
			<? $iterations = ceil($total_videos/$count) ?>
			<? for($i = 1; $i <= $iterations; $i++): ?>
				<? if($i == $page): ?>
				<li><a class="active"><?= $i ?></a></li>
				<? else: ?>
				<?= pagination_link($sandbox, $count, $i) ?> 
				<? endif ?>
			<? endfor ?>
		</ul>
	</div>
</div>