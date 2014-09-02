<? if($video->status == 'encoding'): ?>
Video is still encoding.
<? else: ?>
<?= $video->json_embed_code ?>
<? endif ?>