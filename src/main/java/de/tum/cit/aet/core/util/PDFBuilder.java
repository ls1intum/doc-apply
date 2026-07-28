package de.tum.cit.aet.core.util;

import com.itextpdf.html2pdf.ConverterProperties;
import com.itextpdf.html2pdf.HtmlConverter;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.io.image.ImageDataFactory;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.Rectangle;
import com.itextpdf.kernel.pdf.PdfArray;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfPage;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.action.PdfAction;
import com.itextpdf.layout.Canvas;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.element.AbstractElement;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Div;
import com.itextpdf.layout.element.IBlockElement;
import com.itextpdf.layout.element.IElement;
import com.itextpdf.layout.element.Image;
import com.itextpdf.layout.element.Link;
import com.itextpdf.layout.element.ListItem;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.element.Text;
import com.itextpdf.layout.font.FontProvider;
import com.itextpdf.layout.font.FontSet;
import com.itextpdf.layout.properties.HorizontalAlignment;
import com.itextpdf.layout.properties.Property;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import de.tum.cit.aet.core.exception.PDFGenerationException;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;

public class PDFBuilder {

    private final List<String> headerItems = new ArrayList<>();
    private final String mainHeading;
    private final List<OverviewItem> overviewItems = new ArrayList<>();
    private String overviewTitle;
    private String overviewDescriptionTitle;
    private String overviewDescription;
    private final List<SectionGroup> sectionGroups = new ArrayList<>();
    private SectionGroup currentGroup;
    private String metadataText;
    private String metadataEndText;
    private String siteLinkLabel = "DocApply";
    private String pageLabelPage;
    private String pageLabelOf;
    private byte[] bannerImageBytes;

    private static final String SITE_URL = "https://docapply.aet.cit.tum.de";

    private static final DeviceRgb PRIMARY_COLOR = new DeviceRgb(0x18, 0x72, 0xDD);
    private static final DeviceRgb METADATA_COLOR = new DeviceRgb(0x8d, 0x8d, 0x8f);

    // Reused across exports so converted HTML uses the same Helvetica font as the rest of the document.
    private static final FontProvider HTML_FONT_PROVIDER = createHelveticaFontProvider();

    // ----------------- Font Sizes -----------------
    private static final float FONT_SIZE_MAIN_HEADING = 18f;

    // ----------------- Banner Image -----------------
    private static final float BANNER_MAX_WIDTH = 250f;
    private static final float BANNER_MAX_HEIGHT = 100f;
    private static final float BANNER_MARGIN_BOTTOM = 8f;
    private static final float FONT_SIZE_GROUP_TITLE = 14f;
    private static final float FONT_SIZE_SECTION_TITLE = 12f;
    private static final float FONT_SIZE_TEXT = 10f;
    private static final float FONT_SIZE_METADATA = 7f;

    // ----------------- Spacing -----------------
    private static final float MARGIN_PDF_TOP_AND_BOTTOM = 8f;
    private static final float MARGIN_HEADER_ITEMS_BOTTOM = 8f;
    private static final float MARGIN_TITLE_BOTTOM = 8f;
    private static final float MARGIN_JOB_DESCRIPTION_TOP = 10f;
    private static final float MARGIN_OVERVIEW_SECTION_BOTTOM = 0f;
    private static final float CONTENT_INDENT = 15f;
    private static final float MARGIN_DATA_ROW_BOTTOM = 6f;
    private static final float HEADER_MARGIN_BOTTOM = 16f;
    private static final float LINE_LEADING = 1.0f;
    private static final float METADATA_MARGIN_LEFT_RIGHT = 15f;

    // ----------------- List & Text Layout -----------------
    private static final String BULLET_POINT_SYMBOL = "\u2022";
    private static final float LIST_SYMBOL_INDENT = 12f;

    public PDFBuilder(String mainHeading) {
        this.mainHeading = mainHeading;
    }

    // ----------------- Header -----------------

    /**
     * Adds a header item to be displayed below the main heading
     *
     * @param item the header item text
     * @return this builder for method chaining
     */
    public PDFBuilder addHeaderItem(String item) {
        headerItems.add(item);
        return this;
    }

    // ----------------- Overview -----------------

    public PDFBuilder setOverviewTitle(String title) {
        this.overviewTitle = title;
        return this;
    }

    public PDFBuilder addOverviewItem(String label, String value) {
        overviewItems.add(new OverviewItem(label, value));
        return this;
    }

    public PDFBuilder setOverviewDescriptionTitle(String title) {
        this.overviewDescriptionTitle = title;
        return this;
    }

    public PDFBuilder setOverviewDescription(String htmlDescription) {
        this.overviewDescription = htmlDescription;
        return this;
    }

    // ----------------- Section Groups -----------------

    /**
     * Starts a new section group with the given title
     *
     * @param title the section group title
     * @return this builder for method chaining
     */
    public PDFBuilder startSectionGroup(String title) {
        currentGroup = new SectionGroup(title);
        sectionGroups.add(currentGroup);
        return this;
    }

    /**
     * Starts a new info section with the given title
     *
     * @param title the section title
     * @return this builder for method chaining
     */
    public PDFBuilder startInfoSection(String title) {
        InfoSection section = new InfoSection(title);
        if (currentGroup == null) {
            currentGroup = new SectionGroup(null);
            sectionGroups.add(currentGroup);
        }
        currentGroup.addSection(section);
        return this;
    }

    /**
     * Adds HTML content to the current section
     *
     * @param htmlContent the HTML content to add
     * @return this builder for method chaining
     */
    public PDFBuilder addSectionContent(String htmlContent) {
        if (currentGroup == null || currentGroup.sections.isEmpty()) {
            throw new IllegalStateException("Call startInfoSection first");
        }
        currentGroup.sections.getLast().setHtmlContent(htmlContent);
        return this;
    }

    /**
     * Adds a data row (label-value pair) to the current section
     *
     * @param label the label text
     * @param value the value text
     * @return this builder for method chaining
     */
    public PDFBuilder addSectionData(String label, String value) {
        if (currentGroup == null || currentGroup.sections.isEmpty()) {
            throw new IllegalStateException("Call startInfoSection first");
        }
        currentGroup.sections.getLast().addDataRow(label, value);
        return this;
    }

    // ----------------- Metadata -----------------

    /**
     * Sets the beginning of the metadata text to be displayed at the bottom of the
     * PDF
     *
     * @param metadataText the beginning of metadata text to display (before
     *                     the site-name label)
     * @return this builder for method chaining
     */
    public PDFBuilder setMetadata(String metadataText) {
        this.metadataText = metadataText;
        return this;
    }

    /**
     * Sets the end of the metadata text to be displayed at the bottom of the
     * PDF
     *
     * @param metadataEndText the end of metadata text to display (after the
     *                        site-name label)
     * @return this builder for method chaining
     */
    public PDFBuilder setMetadataEnd(String metadataEndText) {
        this.metadataEndText = metadataEndText;
        return this;
    }

    /**
     * Sets the site name rendered as the clickable link inside the metadata line
     *
     * @param siteLinkLabel the site name to display
     * @return this builder for method chaining
     */
    public PDFBuilder setSiteLinkLabel(String siteLinkLabel) {
        this.siteLinkLabel = siteLinkLabel;
        return this;
    }

    /**
     * Sets the labels for page numbering
     *
     * @param pageLabelPage label for "Page" (e.g., "Seite" or "Page")
     * @param pageLabelOf   label for "of" (e.g., "von" or "of")
     * @return this builder for method chaining
     */
    public PDFBuilder setPageLabels(String pageLabelPage, String pageLabelOf) {
        this.pageLabelPage = pageLabelPage;
        this.pageLabelOf = pageLabelOf;
        return this;
    }

    /**
     * Sets the banner image to be displayed at the top of the PDF
     *
     * @param imageBytes the raw image bytes (JPEG/PNG)
     * @return this builder for method chaining
     */
    public PDFBuilder setBannerImage(byte[] imageBytes) {
        this.bannerImageBytes = imageBytes;
        return this;
    }

    // ----------------- Build PDF -----------------

    /**
     * Builds and generates the PDF document with all configured content
     *
     * @return the generated PDF as a Resource
     * @throws PDFGenerationException if PDF generation fails
     */
    public Resource build() {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdfDoc = new PdfDocument(writer);
            // immediateFlush=false: keep all pages in memory until pdfDoc.close().
            // The default (true) flushes intermediate pages as soon as they're full,
            // which releases their PdfDictionary state. addMetadata() below walks
            // every page via pdfDoc.getPage(i).getPageSize() and would NPE on the
            // already-flushed pages (this.map == null inside iText's PdfDictionary).
            // The bug only surfaced for multi-page PDFs (e.g. application details);
            // single-page PDFs accidentally avoided it because the only page was
            // still the "current" page when addMetadata ran.
            Document document = new Document(pdfDoc, pdfDoc.getDefaultPageSize(), false);

            document.setTopMargin(MARGIN_PDF_TOP_AND_BOTTOM);
            document.setBottomMargin(MARGIN_PDF_TOP_AND_BOTTOM * 3);

            PdfFont normalFont = PdfFontFactory.createFont(StandardFonts.HELVETICA);
            PdfFont boldFont = PdfFontFactory.createFont(StandardFonts.HELVETICA_BOLD);

            // Header Items
            if (!headerItems.isEmpty()) {
                addHeaderItems(document, normalFont);
            }

            // Main Heading
            Paragraph mainHeadingParagraph = new Paragraph(mainHeading)
                .setFont(boldFont)
                .setFontColor(PRIMARY_COLOR)
                .setFontSize(FONT_SIZE_MAIN_HEADING)
                .setTextAlignment(TextAlignment.CENTER)
                .setMarginBottom(HEADER_MARGIN_BOTTOM);
            document.add(mainHeadingParagraph);

            // Banner Image (if set)
            if (bannerImageBytes != null && bannerImageBytes.length > 0) {
                try {
                    Image bannerImage = new Image(ImageDataFactory.create(bannerImageBytes));
                    // Scale image to fit within max dimensions while maintaining aspect ratio
                    float originalWidth = bannerImage.getImageWidth();
                    float originalHeight = bannerImage.getImageHeight();
                    float scale = Math.min(BANNER_MAX_WIDTH / originalWidth, BANNER_MAX_HEIGHT / originalHeight);
                    if (scale < 1) {
                        bannerImage.scaleToFit(originalWidth * scale, originalHeight * scale);
                    }
                    bannerImage.setHorizontalAlignment(HorizontalAlignment.CENTER);
                    bannerImage.setMarginBottom(BANNER_MARGIN_BOTTOM);
                    document.add(bannerImage);
                } catch (Exception e) {
                    // Log and continue without banner if image processing fails
                }
            }

            // Overview Section
            if (!overviewItems.isEmpty()) {
                addOverviewSection(document, normalFont, boldFont);
            }

            // Section Groups
            for (SectionGroup group : sectionGroups) {
                if (group.title != null) {
                    Paragraph groupTitle = new Paragraph(group.title)
                        .setFont(boldFont)
                        .setFontSize(FONT_SIZE_GROUP_TITLE)
                        .setFontColor(PRIMARY_COLOR)
                        .setMarginBottom(MARGIN_TITLE_BOTTOM);
                    document.add(groupTitle);
                }
                for (InfoSection section : group.sections) {
                    addInfoSection(document, section, normalFont, boldFont);
                }
            }

            // Metadata
            if (metadataText != null && !metadataText.isEmpty()) {
                addMetadata(pdfDoc, normalFont);
            }

            document.close();
            pdfDoc.close();
            return new ByteArrayResource(baos.toByteArray());
        } catch (IOException e) {
            throw new PDFGenerationException("Failed to generate PDF", e);
        }
    }

    // ----------------- Helpers -----------------

    /**
     * Adds header items in a single line separated by |
     */
    private void addHeaderItems(Document document, PdfFont normalFont) {
        Paragraph headerLine = new Paragraph()
            .setFont(normalFont)
            .setFontSize(FONT_SIZE_METADATA)
            .setFontColor(METADATA_COLOR)
            .setTextAlignment(TextAlignment.CENTER)
            .setMarginTop(0f)
            .setMarginBottom(MARGIN_HEADER_ITEMS_BOTTOM);

        for (int i = 0; i < headerItems.size(); i++) {
            headerLine.add(new Text(headerItems.get(i)));
            if (i < headerItems.size() - 1) {
                headerLine.add(new Text(" | "));
            }
        }

        document.add(headerLine);
    }

    private void addOverviewSection(Document document, PdfFont normalFont, PdfFont boldFont) {
        Div container = new Div().setMarginBottom(MARGIN_OVERVIEW_SECTION_BOTTOM);

        // Step 1: Add overview title if present
        if (overviewTitle != null) {
            Paragraph title = new Paragraph(overviewTitle)
                .setFont(boldFont)
                .setFontSize(FONT_SIZE_GROUP_TITLE)
                .setFontColor(PRIMARY_COLOR)
                .setMarginBottom(MARGIN_OVERVIEW_SECTION_BOTTOM);
            container.add(title);
        }

        // Step 2: Create and populate overview items table
        Table table = new Table(2);
        table.setWidth(UnitValue.createPercentValue(100));
        table.setBorder(Border.NO_BORDER);
        table.setMarginLeft(CONTENT_INDENT);

        for (int i = 0; i < overviewItems.size(); i++) {
            OverviewItem item = overviewItems.get(i);

            Paragraph cellContent = new Paragraph()
                .add(new Text(item.label + " ").setFont(boldFont).setFontSize(FONT_SIZE_TEXT))
                .add(new Text(item.value).setFont(normalFont).setFontSize(FONT_SIZE_TEXT))
                .setMargin(0);

            Cell cell;
            if (i == overviewItems.size() - 1 && overviewItems.size() % 2 == 1) {
                cell = new Cell(1, 2);
            } else {
                cell = new Cell();
            }

            cell.add(cellContent).setBorder(Border.NO_BORDER).setPaddingRight(10f);

            table.addCell(cell);
        }

        container.add(table);

        // Step 3: Add overview description section if present
        if (overviewDescription != null && !overviewDescription.isEmpty()) {
            // Step 3a: Add description title
            if (overviewDescriptionTitle != null && !overviewDescriptionTitle.isEmpty()) {
                Paragraph descTitle = new Paragraph(overviewDescriptionTitle)
                    .setFont(boldFont)
                    .setFontSize(FONT_SIZE_SECTION_TITLE)
                    .setMarginTop(MARGIN_JOB_DESCRIPTION_TOP)
                    .setMarginBottom(MARGIN_TITLE_BOTTOM)
                    .setMarginLeft(CONTENT_INDENT);
                container.add(descTitle);
            }
            // Step 3b: Parse and add HTML description content
            List<IBlockElement> elements = parseHtmlContent(overviewDescription, normalFont);
            for (IBlockElement element : elements) {
                if (element instanceof Paragraph para) {
                    para.setMarginTop(0);
                    para.setMarginLeft(CONTENT_INDENT);
                } else if (element instanceof com.itextpdf.layout.element.List list) {
                    list.setMarginTop(0);
                    list.setMarginLeft(CONTENT_INDENT);
                }
                container.add(element);
            }
        }

        document.add(container);
    }

    private void addInfoSection(Document document, InfoSection section, PdfFont normalFont, PdfFont boldFont) {
        Div container = new Div();

        if (section.title != null && !section.title.isEmpty()) {
            Paragraph title = new Paragraph(section.title)
                .setFont(boldFont)
                .setMarginTop(0)
                .setFontSize(FONT_SIZE_SECTION_TITLE)
                .setMarginBottom(MARGIN_TITLE_BOTTOM);
            container.add(title);
        }

        if (section.htmlContent != null && !section.htmlContent.isEmpty()) {
            List<IBlockElement> elements = parseHtmlContent(section.htmlContent, normalFont);
            for (IBlockElement element : elements) {
                if (element instanceof Paragraph para) {
                    para.setMarginTop(0);
                    para.setMarginLeft(CONTENT_INDENT);
                } else if (element instanceof com.itextpdf.layout.element.List list) {
                    list.setMarginTop(0);
                    list.setMarginLeft(CONTENT_INDENT);
                }
                container.add(element);
            }
        }

        for (DataRow row : section.dataRows) {
            Paragraph dataRow = new Paragraph()
                .add(new Text(row.label + ": ").setFont(boldFont))
                .add(new Text(row.value).setFont(normalFont))
                .setFontSize(FONT_SIZE_TEXT)
                .setMargin(0)
                .setMarginBottom(MARGIN_DATA_ROW_BOTTOM)
                .setMarginLeft(CONTENT_INDENT)
                .setMultipliedLeading(LINE_LEADING);
            container.add(dataRow);
        }

        document.add(container);
    }

    /**
     * Adds metadata text at the bottom of the last PDF page
     */
    private void addMetadata(PdfDocument pdfDoc, PdfFont normalFont) {
        int totalPages = pdfDoc.getNumberOfPages();

        for (int i = 1; i <= totalPages; i++) {
            PdfPage page = pdfDoc.getPage(i);
            Rectangle pageSize = page.getPageSize();

            Canvas canvas = new Canvas(page, pageSize);

            Paragraph metadataParagraph = new Paragraph()
                .setFont(normalFont)
                .setFontSize(FONT_SIZE_METADATA)
                .setFontColor(METADATA_COLOR)
                .setTextAlignment(TextAlignment.CENTER)
                .setWidth(pageSize.getWidth() - 8 * METADATA_MARGIN_LEFT_RIGHT);

            metadataParagraph.add(new Text(metadataText));

            // add the site name as clickable Link
            Link siteLink = new Link(siteLinkLabel, PdfAction.createURI(SITE_URL));
            siteLink.setFontColor(PRIMARY_COLOR).setUnderline().setFont(normalFont).setFontSize(FONT_SIZE_METADATA);
            // iText link annotations default to a 1pt border; clear it.
            siteLink.getLinkAnnotation().setBorder(new PdfArray(new float[] { 0, 0, 0 }));

            metadataParagraph.add(siteLink);

            if (metadataEndText != null && !metadataEndText.isEmpty()) {
                metadataParagraph.add(new Text(metadataEndText));
            }

            canvas.showTextAligned(metadataParagraph, pageSize.getWidth() / 2, MARGIN_PDF_TOP_AND_BOTTOM, TextAlignment.CENTER);

            // --- Page Number ---
            Paragraph pageNumber = new Paragraph(String.format("%s %d %s %d", pageLabelPage, i, pageLabelOf, totalPages))
                .setFont(normalFont)
                .setFontSize(FONT_SIZE_METADATA)
                .setFontColor(METADATA_COLOR);

            canvas.showTextAligned(
                pageNumber,
                pageSize.getRight() - METADATA_MARGIN_LEFT_RIGHT,
                MARGIN_PDF_TOP_AND_BOTTOM,
                TextAlignment.RIGHT
            );

            canvas.close();
        }
    }

    /**
     * Creates a font provider exposing only the Helvetica family (regular, bold, italic and
     * bold-italic) with Helvetica as the default family, so HTML conversion stays on a single font.
     *
     * @return a font provider limited to the Helvetica family
     */
    private static FontProvider createHelveticaFontProvider() {
        FontSet fontSet = new FontSet();
        fontSet.addFont(StandardFonts.HELVETICA);
        fontSet.addFont(StandardFonts.HELVETICA_BOLD);
        fontSet.addFont(StandardFonts.HELVETICA_OBLIQUE);
        fontSet.addFont(StandardFonts.HELVETICA_BOLDOBLIQUE);
        return new FontProvider(fontSet, StandardFonts.HELVETICA);
    }

    /**
     * Drops the font sizes the HTML converter resolved onto nested elements so that they inherit the
     * size set on the surrounding block instead. Converted bold and italic runs carry their own font
     * size, which would otherwise take precedence and render them larger than the text around them.
     * Their font is deliberately kept, since that is what selects the bold or italic Helvetica variant.
     *
     * @param element the converted element whose descendants should inherit the block font size
     */
    private static void clearNestedFontSizes(IElement element) {
        if (element instanceof AbstractElement<?> abstractElement) {
            for (IElement child : abstractElement.getChildren()) {
                child.deleteOwnProperty(Property.FONT_SIZE);
                clearNestedFontSizes(child);
            }
        }
    }

    private List<IBlockElement> parseHtmlContent(String html, PdfFont normalFont) {
        List<IBlockElement> elements = new ArrayList<>();

        try {
            String processedHtml = html.replaceAll("<ol>", "<ul>").replaceAll("</ol>", "</ul>");

            ConverterProperties props = new ConverterProperties();
            props.setFontProvider(HTML_FONT_PROVIDER);

            List<IElement> pdfElements = HtmlConverter.convertToElements(processedHtml, props);

            for (IElement element : pdfElements) {
                if (element instanceof IBlockElement blockElement) {
                    clearNestedFontSizes(blockElement);
                    if (blockElement instanceof Paragraph) {
                        ((Paragraph) blockElement).setFont(normalFont)
                            .setFontSize(FONT_SIZE_TEXT)
                            .setMarginBottom(MARGIN_DATA_ROW_BOTTOM)
                            .setMultipliedLeading(LINE_LEADING);
                        // A direct import of iText's List class is required to distinguish it from
                        // Java's List.
                    } else if (blockElement instanceof com.itextpdf.layout.element.List list) {
                        list
                            .setListSymbol(BULLET_POINT_SYMBOL)
                            .setFont(normalFont)
                            .setFontSize(FONT_SIZE_TEXT)
                            .setMarginBottom(MARGIN_DATA_ROW_BOTTOM)
                            .setPaddingLeft(0f)
                            .setSymbolIndent(LIST_SYMBOL_INDENT);

                        for (IElement item : list.getChildren()) {
                            if (item instanceof ListItem) {
                                ((ListItem) item).setFont(normalFont).setFontSize(FONT_SIZE_TEXT).setMarginLeft(CONTENT_INDENT);
                            }
                        }
                    }

                    elements.add(blockElement);
                }
            }
        } catch (Exception e) {
            String plainText = html.replaceAll("<[^>]*>", "").replaceAll("&nbsp;", " ").trim();
            elements.add(
                new Paragraph(plainText)
                    .setFont(normalFont)
                    .setFontSize(FONT_SIZE_TEXT)
                    .setMarginBottom(MARGIN_DATA_ROW_BOTTOM)
                    .setMultipliedLeading(LINE_LEADING)
            );
        }

        return elements;
    }

    // ----------------- Inner Classes -----------------
    private static class OverviewItem {

        String label;
        String value;

        OverviewItem(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }

    private static class SectionGroup {

        String title;
        List<InfoSection> sections = new ArrayList<>();

        SectionGroup(String title) {
            this.title = title;
        }

        void addSection(InfoSection section) {
            sections.add(section);
        }
    }

    private static class InfoSection {

        String title;
        String htmlContent;
        List<DataRow> dataRows = new ArrayList<>();

        InfoSection(String title) {
            this.title = title;
        }

        void setHtmlContent(String content) {
            this.htmlContent = content;
        }

        void addDataRow(String label, String value) {
            this.dataRows.add(new DataRow(label, value));
        }
    }

    private static class DataRow {

        String label;
        String value;

        DataRow(String label, String value) {
            this.label = label;
            this.value = value;
        }
    }
}
