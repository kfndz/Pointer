function login(){

  const email =
    document.getElementById("email").value;

  const senha =
    document.getElementById("senha").value;

  if(
    email === "admin@gmail.com"
    &&
    senha === "123456"
  ){

    document.getElementById(
      "loginBox"
    ).style.display = "none";

    document.getElementById(
      "sistema"
    ).style.display = "block";

  }else{

    alert("Login inválido");

  }

}

function mostrarTela(tela){

  const telas =
    document.querySelectorAll(".tela");

  telas.forEach(item => {

    item.style.display = "none";

  });

  document.getElementById(
    tela
  ).style.display = "block";

}

function registrarEntrada(){

  const horario =
    new Date().toLocaleString();

  localStorage.setItem(
    "entrada",
    horario
  );

  alert("Entrada registrada!");

}

function registrarSaida(){

  const entrada =
    localStorage.getItem("entrada");

  const saida =
    new Date().toLocaleString();

  const lista =
    document.getElementById("lista");

  const item =
    document.createElement("li");

  item.innerHTML = `
    Entrada: ${entrada}
    <br>
    Saída: ${saida}
  `;

  lista.appendChild(item);

  mostrarTela("historico");

  alert("Saída registrada!");

}

function toggleMenu(){

  const sidebar =
    document.getElementById("sidebar");

  sidebar.classList.toggle("active");

}