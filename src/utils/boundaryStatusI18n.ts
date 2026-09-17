export interface BoundaryStatusText {
  boundarySet: string;
  adjustArea: string;
  circleInstruction: string;
  rectangleInstruction: string;
  polygonInstruction: string;
  autoCalculated: string;
}

const en: BoundaryStatusText = {
  boundarySet: 'Boundary set · approx',
  adjustArea: '(adjust area input to resize)',
  circleInstruction: 'Click the map to place the circle center.',
  rectangleInstruction: 'Click two opposite corners on the map to draw the rectangle.',
  polygonInstruction: 'Click sequential points on the map to draw a custom polygon boundary.',
  autoCalculated: '(auto-calculated from boundary)'
};

const translations: Record<string, BoundaryStatusText> = {
  en,
  de: { boundarySet: 'Grenze festgelegt · ca.', adjustArea: '(Fläche anpassen, um die Größe zu ändern)', circleInstruction: 'Klicken Sie auf die Karte, um den Mittelpunkt des Kreises zu setzen.', rectangleInstruction: 'Klicken Sie auf zwei gegenüberliegende Ecken der Karte, um das Rechteck zu zeichnen.', polygonInstruction: 'Klicken Sie nacheinander auf Punkte der Karte, um eine benutzerdefinierte Polygon-Grenze zu zeichnen.', autoCalculated: '(automatisch aus der Grenze berechnet)' },
  pl: { boundarySet: 'Granica ustawiona · ok.', adjustArea: '(zmień powierzchnię, aby zmienić rozmiar)', circleInstruction: 'Kliknij mapę, aby ustawić środek okręgu.', rectangleInstruction: 'Kliknij dwa przeciwległe narożniki na mapie, aby narysować prostokąt.', polygonInstruction: 'Klikaj kolejne punkty na mapie, aby narysować własną granicę wielokąta.', autoCalculated: '(obliczone automatycznie z granicy)' },
  nl: { boundarySet: 'Grens ingesteld · circa', adjustArea: '(pas de oppervlakte aan om de grootte te wijzigen)', circleInstruction: 'Klik op de kaart om het middelpunt van de cirkel te plaatsen.', rectangleInstruction: 'Klik op twee tegenoverliggende hoeken om de rechthoek te tekenen.', polygonInstruction: 'Klik achtereenvolgens op punten om een vrije perceelgrens te tekenen.', autoCalculated: '(automatisch berekend uit de grens)' },
  cs: { boundarySet: 'Hranice nastavena · přibližně', adjustArea: '(velikost upravíte změnou plochy)', circleInstruction: 'Kliknutím do mapy umístěte střed kruhu.', rectangleInstruction: 'Klikněte na dva protilehlé rohy a nakreslete obdélník.', polygonInstruction: 'Postupným klikáním zakreslete vlastní hranici polygonu.', autoCalculated: '(automaticky vypočteno z hranice)' },
  da: { boundarySet: 'Grænse angivet · ca.', adjustArea: '(juster arealet for at ændre størrelsen)', circleInstruction: 'Klik på kortet for at placere cirklens centrum.', rectangleInstruction: 'Klik på to modsatte hjørner på kortet for at tegne rektanglet.', polygonInstruction: 'Klik på punkter i rækkefølge på kortet for at tegne en brugerdefineret polygongrænse.', autoCalculated: '(beregnet automatisk ud fra grænsen)' },
  no: { boundarySet: 'Grense angitt · ca.', adjustArea: '(juster arealet for å endre størrelse)', circleInstruction: 'Klikk på kartet for å plassere sentrum av sirkelen.', rectangleInstruction: 'Klikk på to motsatte hjørner for å tegne rektangelet.', polygonInstruction: 'Klikk punkt for punkt på kartet for å tegne tomtegrensen.', autoCalculated: '(automatisk beregnet fra grensen)' },
  sv: { boundarySet: 'Gräns angiven · cirka', adjustArea: '(justera arean för att ändra storlek)', circleInstruction: 'Klicka på kartan för att placera cirkelns centrum.', rectangleInstruction: 'Klicka på två motsatta hörn för att rita rektangeln.', polygonInstruction: 'Klicka punkt för punkt på kartan för att rita en egen tomtgräns.', autoCalculated: '(automatiskt beräknad från gränsen)' },
  sk: { boundarySet: 'Hranica určená · približne', adjustArea: '(veľkosť upravíte zmenou plochy)', circleInstruction: 'Kliknite na mapu a umiestnite stred kruhu.', rectangleInstruction: 'Kliknite na dva protiľahlé rohy obdĺžnika.', polygonInstruction: 'Postupným klikaním zakreslite hranicu polygónu.', autoCalculated: '(automaticky vypočítané z hranice)' },
  fr: { boundarySet: 'Limite définie · env.', adjustArea: '(modifiez la surface pour redimensionner)', circleInstruction: 'Cliquez sur la carte pour placer le centre du cercle.', rectangleInstruction: 'Cliquez sur deux coins opposés pour dessiner le rectangle.', polygonInstruction: 'Cliquez successivement sur la carte pour dessiner une limite polygonale.', autoCalculated: '(calculé automatiquement à partir de la limite)' },
  es: { boundarySet: 'Límite definido · aprox.', adjustArea: '(ajuste la superficie para cambiar el tamaño)', circleInstruction: 'Haga clic en el mapa para situar el centro del círculo.', rectangleInstruction: 'Haga clic en dos esquinas opuestas para dibujar el rectángulo.', polygonInstruction: 'Haga clic en puntos sucesivos para dibujar un límite poligonal.', autoCalculated: '(calculado automáticamente a partir del límite)' },
  fi: { boundarySet: 'Rajaus asetettu · noin', adjustArea: '(muuta pinta-alaa koon säätämiseksi)', circleInstruction: 'Aseta ympyrän keskipiste napsauttamalla karttaa.', rectangleInstruction: 'Piirrä suorakulmio napsauttamalla kahta vastakkaista kulmaa.', polygonInstruction: 'Piirrä monikulmiorajaus napsauttamalla pisteitä peräkkäin.', autoCalculated: '(laskettu automaattisesti rajauksesta)' }
};

export const getBoundaryStatusText = (language?: string): BoundaryStatusText =>
  translations[String(language || 'en').toLowerCase().split('-')[0]] || en;
