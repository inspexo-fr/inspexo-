import UIKit
import UniformTypeIdentifiers

// Extension de partage Inspexo — TEST DE FAISABILITÉ (jamais publiée en l'état).
// Depuis le menu Partager de l'appli Leboncoin / La Centrale : récupère l'URL
// de l'annonce, la copie dans le presse-papiers (filet de sécurité), puis ouvre
// l'appli hôte via inspexo://partage?url=… — l'annonce est ensuite lue dans une
// WebView SUR le téléphone (aucune requête de nos serveurs vers le site).
//
// Note : l'ouverture de l'appli hôte passe par la chaîne de répondeurs
// (sélecteur openURL:) — accepté pour un build de développement, à remplacer
// par un mécanisme App Group + ouverture manuelle avant toute publication.
class ShareViewController: UIViewController {

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        recupererUrlPartagee()
    }

    private func recupererUrlPartagee() {
        let attachements = (extensionContext?.inputItems as? [NSExtensionItem])?
            .flatMap { $0.attachments ?? [] } ?? []
        let groupe = DispatchGroup()
        var urlRecue: String?

        for item in attachements {
            if item.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                groupe.enter()
                item.loadItem(forTypeIdentifier: UTType.url.identifier) { data, _ in
                    if urlRecue == nil, let u = data as? URL { urlRecue = u.absoluteString }
                    groupe.leave()
                }
            } else if item.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                groupe.enter()
                item.loadItem(forTypeIdentifier: UTType.plainText.identifier) { data, _ in
                    if urlRecue == nil, let texte = data as? String,
                       let plage = texte.range(of: #"https://\S+"#, options: .regularExpression) {
                        urlRecue = String(texte[plage])
                    }
                    groupe.leave()
                }
            }
        }

        groupe.notify(queue: .main) { [weak self] in
            self?.terminer(avec: urlRecue)
        }
    }

    private func terminer(avec url: String?) {
        guard let url,
              let encodee = url.addingPercentEncoding(withAllowedCharacters: .alphanumerics),
              let lienProfond = URL(string: "inspexo://partage?url=\(encodee)")
        else {
            extensionContext?.completeRequest(returningItems: nil)
            return
        }
        // Filet de sécurité : si l'ouverture automatique échoue, l'URL est
        // dans le presse-papiers, collable dans l'appli.
        UIPasteboard.general.string = url
        ouvrirAppliHote(lienProfond)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
    }

    private func ouvrirAppliHote(_ url: URL) {
        let selecteur = sel_registerName("openURL:")
        var repondeur: UIResponder? = self
        while let courant = repondeur {
            if courant.responds(to: selecteur), !(courant is UIViewController) {
                courant.perform(selecteur, with: url)
                return
            }
            repondeur = courant.next
        }
    }
}
