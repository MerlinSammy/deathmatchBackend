const express = require("express")
const app = express();
const fs = require('fs');
const csv = require('csv-parser');
const bodyParser = require('body-parser');
const { log } = require("console");
const cors = require("cors");
const { stringify } = require("csv-stringify/sync");
const path = require("path")

app.use(bodyParser.json());
app.use(cors());


app.get("/api", (req, res) => {
    res.json({"users": ["user1", "user2", "user3"]})
})

let users = []
const CSV_FILE = path.join(process.cwd(),'teilnehmer.csv');
const savedTablePath = path.join(process.cwd(),'savedTable.txt');
const csvDummyDataPath = path.join(process.cwd(),'dummyData.csv');
let savedTable;



function readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}

//Get Users der Teilnehmer CSV
app.get('/users', async (req, res) => {
  console.log(CSV_FILE);
  
    try {
        const users = await readCSVFile(CSV_FILE);
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Lesen der CSV-Datei' });
    }
});

//Get Users der Teilnehmer CSV
app.get('/', async (req, res) => {  
  res.json("Server Working");
});

//Get Users der Teilnehmer CSV
app.get('/dummyData', async (req, res) => {
    try {
        const users = await readCSVFile(csvDummyDataPath);
        
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Lesen der CSV-Datei' });
    }
});

//Füge User der Teilnehmer CSV hinzu
app.post('/addUser', (req, res) => {
    const { Name, Gewicht, PR } = req.body;

    if (!Name || !PR || !Gewicht) {
        return res.status(400).json({ error: 'Alle Felder (Name, Gewicht, PR) sind erforderlich.' });
    }

    console.log("REqBody",req.body);
    
    const newUser = `\n${Name},${Gewicht},${PR},0,0,0,0,0,0,0,0,0,0`;

    console.log("NewUser",newUser);
    console.log("CSVFilePath",CSV_FILE);
    

    fs.appendFile(CSV_FILE, newUser, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Fehler beim Speichern in die CSV-Datei' });
        }
        res.json({ message: 'User erfolgreich hinzugefügt', user: { Name, PR, Gewicht } });
    });
});

//Lösche den User mit angegebenen Usernamen
app.delete('/deleteUser/:name', async (req, res) => {
    const nameToDelete = req.params.name;

    try {
        const users = await readCSVFile(CSV_FILE);
        const filteredUsers = users.filter(user => user.Name !== nameToDelete);

        if (users.length === filteredUsers.length) {
            return res.status(404).json({ error: 'User nicht gefunden' });
        }

        // CSV neu schreiben mit den gefilterten Daten
        const csvData = 'Name,Gewicht,PR,Versuch1,Versuch2,Versuch3,Versuch4,Versuch5,Versuch6,Versuch7,Versuch8,Versuch9,Versuch10\n' + filteredUsers.map(user => `${user.Name},${user.Gewicht},${user.PR},0,0,0,0,0,0,0,0,0,0`).join('\n');
        fs.writeFileSync(CSV_FILE, csvData);

        res.json({ message: `User ${nameToDelete} wurde entfernt.` });
    } catch (error) {
        res.status(500).json({ error: 'Fehler beim Bearbeiten der CSV-Datei' });
    }
});

// API-Route zum Hinzufügen der Spalte "Versuch 1"
app.post("/addColumn/:spaltenName", async (req, res) => {
    const spaltenName = req.params.spaltenName;

    try {
      const rows = [];
  
      // CSV-Datei einlesen
      fs.createReadStream(CSV_FILE)
        .pipe(csv())
        .on("data", (data) => {
          data[spaltenName] = "0"; // Neue Spalte mit leerem Wert hinzufügen
          rows.push(data);
        })
        .on("end", () => {
          // Neue CSV-Datei mit der zusätzlichen Spalte schreiben
          const updatedCSV = stringify(rows, { header: true });
          fs.writeFileSync(CSV_FILE, updatedCSV);
          res.json({ message: "Spalte "+spaltenName+" erfolgreich hinzugefügt!" });
        });
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Bearbeiten der CSV-Datei" });
    }
  });

// API-Route zum Entfernen der letzten nicht-geschützten Spalte
app.post("/remove-last-column", (req, res) => {
    let rows = [];
    let headers = [];
    let hasRemovableColumn = false; // Flag, um doppelte Antworten zu vermeiden
  
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("headers", (headerList) => {
        // Definiere geschützte Spalten
        const protectedColumns = ["Name", "Gewicht", "PR"];
  
        // Finde alle Spalten, die entfernt werden dürfen
        const removableColumns = headerList.filter(col => !protectedColumns.includes(col));
  
        if (removableColumns.length === 0) {
          hasRemovableColumn = false; // Keine entfernbare Spalte vorhanden
        } else {
          hasRemovableColumn = true;
          removableColumns.pop(); // Letzte entfernbare Spalte löschen
          headers = [...protectedColumns, ...removableColumns];
        }
      })
      .on("data", (data) => {
        if (hasRemovableColumn) {
          const newRow = {};
          headers.forEach((header) => {
            newRow[header] = data[header]; // Nur die verbleibenden Spalten speichern
          });
          rows.push(newRow);
        }
      })
      .on("end", () => {
        if (!hasRemovableColumn) {
          return res.status(400).json({ error: "Keine Spalte zum Entfernen verfügbar." });
        }
        try {
          // CSV ohne die entfernte Spalte speichern
          const updatedCSV = stringify(rows, { header: true });
          fs.writeFileSync(CSV_FILE, updatedCSV);
          res.json({ message: "Letzte Spalte erfolgreich entfernt!", newHeaders: headers });
        } catch (err) {
          res.status(500).json({ error: "Fehler beim Schreiben der Datei", details: err });
        }
      })
      .on("error", (err) => {
        res.status(500).json({ error: "Fehler beim Einlesen der Datei", details: err });
      });
  });

// API-Route zum Aktualisieren eines Werts in einer bestimmten Spalte
//curl -X POST http://localhost:3000/update-attempt -H "Content-Type: application/json" -d '{"name": "Florian Fink", "column": "Versuch1", "value": "300"}'
app.post("/update-attempt", (req, res) => {
    const { name, column, value } = req.body; // Name des Users, Spalte und neuer Wert
  
    if (!name || !column || value === undefined) {
      return res.status(400).json({ error: "Bitte 'name', 'column' und 'value' angeben." });
    }
  
    const rows = [];
  
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", (data) => {
        if (data.Name === name) {
          data[column] = value; // Wert in der angegebenen Spalte setzen
        }
        rows.push(data);
      })
      .on("end", () => {
        try {
          // CSV-Datei mit aktualisierten Werten speichern
          const updatedCSV = stringify(rows, { header: true });
          fs.writeFileSync(CSV_FILE, updatedCSV);
          res.json({ message: `Wert für '${name}' in Spalte '${column}' erfolgreich aktualisiert!`, data: rows });
        } catch (err) {
          res.status(500).json({ error: "Fehler beim Schreiben der Datei", details: err });
        }
      })
      .on("error", (err) => {
        res.status(500).json({ error: "Fehler beim Einlesen der Datei", details: err });
      });
  });

// API-Route zum Entfernen eines Werts aus einer bestimmten Spalte
// curl -X POST http://localhost:3000/remove-attempt -H "Content-Type: application/json" -d '{"name": "Florian Fink", "column": "Versuch1"}'

app.post("/remove-attempt", (req, res) => {
    const { name, column } = req.body; // Name des Users und Spalte
  
    if (!name || !column) {
      return res.status(400).json({ error: "Bitte 'name' und 'column' angeben." });
    }
  
    const rows = [];
  
    fs.createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", (data) => {
        if (data.Name === name) {
          data[column] = ""; // Nur den Wert in der angegebenen Spalte entfernen
        }
        rows.push(data);
      })
      .on("end", () => {
        try {
          // CSV mit aktualisierten Werten speichern
          const updatedCSV = stringify(rows, { header: true });
          fs.writeFileSync(CSV_FILE, updatedCSV);
          res.json({ message: `Wert für '${name}' in Spalte '${column}' erfolgreich entfernt!`, data: rows });
        } catch (err) {
          res.status(500).json({ error: "Fehler beim Schreiben der Datei", details: err });
        }
      })
      .on("error", (err) => {
        res.status(500).json({ error: "Fehler beim Einlesen der Datei", details: err });
      });
  });

  app.post("/saveTable", (req, res) => {
    savedTable = req.body
    console.log(req.body);


    fs.writeFile(savedTablePath, savedTable.htmlString, (err) => {
      if (err) {
        console.error("Fehler beim Schreiben:", err);
        return res.status(500).json({ message: "Speichern fehlgeschlagen" });
      }
      res.json({ message: "TXT-Datei erfolgreich gespeichert!" });
    });
  });

  app.get('/loadTable', async (req, res) => {
    fs.readFile(savedTablePath, "utf8", (err, data) => {
      if (err) {
        console.error("Fehler beim Lesen:", err);
        return res.status(500).json({ message: "Datei konnte nicht geladen werden." });
      }
      res.json(data);
    });
  });



app.listen(3000, () => {console.log("Server started on port 3000");
})