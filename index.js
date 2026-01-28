const express = require("express");
const app = express();
const port = 3127;

app.use(express.json()); // se convierten todos los datos a json

/*let videojuegos = [{id:1,titulo:"Red Dead Redemption 2", precio: 20},
    {id:2,titulo:"Mafia 1", precio: 27},
    {id:3,titulo:"Gta V", precio: 110}
];

//recibe la request del usuario y la respuesta.
app.get("/",(req,res)=>{
    return res.json("Hola que tal soy Sauls");
})

app.get("/mis-videojuegos",(req,res)=>{
    return res.json([
        videojuegos[0], videojuegos[2]

    ]);
})

app.post("/guardar-juego",(req,res)=>{
    let nuevoJuego ={
        id: videojuegos.length+1,
        titulo: req.body.titulo,
        precio: req.body.precio
    }
    videojuegos.push(nuevoJuego);
    return res.status(200).json(nuevoJuego);
})*/

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

async function analizarRSS() {
    // La URL de Compras Estatales
    const url = "https://www.comprasestatales.gub.uy/consultas/rss/tipo-pub/ALL/tipo-fecha/MOD/orden/ORD_MOD/tipo-orden/DESC/rango-fecha/2026-01-15+00%3A00%3A00_2026-01-21+23%3A59%3A59";

    try {
        console.log("--- Conectando con ARCE... ---");
        const response = await axios.get(url,{
            headers: {
                // Este es el "disfraz". Le decimos que somos un Chrome en Windows.
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/xml, text/xml, */*',
                'Accept-Language': 'es-ES,es;q=0.9',
            }
            

        });
        console.log("¡Conexión exitosa!");
        // Aquí sigues con el parser...
        
        const parser = new XMLParser();
        const jObj = parser.parse(response.data);

        // El RSS estructura la data en: rss -> channel -> item (array)
        const items = jObj.rss.channel.item;
        
        console.log(`Se encontraron ${items.length} publicaciones recientes.\n`);

        // Analizamos las primeras 3 para ver la estructura exacta
        items.slice(0, 3).forEach((item, index) => {
            console.log(`--- Licitación #${index + 1} ---`);
            console.log(`Título: ${item.title}`);
            console.log(`Link: ${item.link}`);
            console.log(`Fecha Pub: ${item.pubDate}`);
            // La descripción suele traer el organismo y el tipo de compra
            console.log(`Descripción resumida: ${item.description.substring(0, 100)}...`);
            console.log("----------------------------\n");
        });

        // Tip para tu cliente: Así es como filtraríamos por rubro
        const rubroBuscado = "limpieza";
        const filtrados = items.filter(i => 
            i.title.toLowerCase().includes(rubroBuscado) || 
            i.description.toLowerCase().includes(rubroBuscado)
        );

        console.log(`Resultado del filtro para '${rubroBuscado}': ${filtrados.length} coincidencias.`);

    } catch (error) {
        console.error("Error al leer el RSS:", error.message);
    }
}

analizarRSS();


//se pasa el puerto (port) y una funcion anonima por parametro, que se ejecuta cada vez que el servidor arranque

app.listen(port,()=>{
    console.log("Servidor de node escuchando en http://localhost:"+port)

})

