// ANO AUTOMÁTICO NO RODAPÉ

const ano = document.getElementById("ano");

if (ano) {

    ano.textContent =
        `© ${new Date().getFullYear()} - Willians de Jesus Freitas`;

}


// DESTAQUE DOS LINKS DO MENU

const linksMenu =
    document.querySelectorAll(".nav-links a");

linksMenu.forEach(link => {

    link.addEventListener("click", function () {

        linksMenu.forEach(item => {

            item.classList.remove("ativo");

        });

        this.classList.add("ativo");

    });

});
