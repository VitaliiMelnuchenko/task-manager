var modal = document.getElementById('myModal');
var btn = document.getElementById('myBtn');
var span = document.getElementsByClassName('close')[0];
var editBtn = document.getElementsByClassName('open_madal');

for(var i = 0; i < editBtn.length; i++){
    editBtn[i].onclick = function() {
        modal.style.display = 'block';
    }
}


btn.onclick = function() {
    modal.style.display = 'block';
}
span.onclick = function() {
    modal.style.display = 'none';
}

window.onclick = function(event) {
    if(event.target == modal) {
        modal.style.display = 'none';
    }
}