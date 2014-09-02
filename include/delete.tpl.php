<? if($error): ?>
An error occured with the following message: <br />
<pre><?= $error ?></pre>
<? else: ?>
Successfully delete video <?= $_GET['id'] ?>
<? endif ?>