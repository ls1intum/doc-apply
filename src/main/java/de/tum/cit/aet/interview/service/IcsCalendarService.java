package de.tum.cit.aet.interview.service;

import de.tum.cit.aet.interview.domain.InterviewSlot;
import de.tum.cit.aet.job.domain.Job;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Service;

/**
 * Service for generating ICS (iCalendar) files for interview appointments.
 */
@Service
public class IcsCalendarService {

    private static final ZoneId CET_TIMEZONE = ZoneId.of("Europe/Berlin");
    private static final DateTimeFormatter ICS_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss");

    /**
     * Generates an ICS calendar file content for an interview slot.
     *
     * @param slot the interview slot
     * @param job  the job associated with the interview
     * @return the ICS file content as a String
     */
    public String generateIcsContent(InterviewSlot slot, Job job) {
        ZonedDateTime startTime = slot.getStartDateTime().atZone(CET_TIMEZONE);
        ZonedDateTime endTime = slot.getEndDateTime().atZone(CET_TIMEZONE);
        String uid = "interview-" + slot.getId() + "@docapply.tum.de";

        StringBuilder ics = new StringBuilder();
        ics.append("BEGIN:VCALENDAR\r\n");
        ics.append("VERSION:2.0\r\n");
        ics.append("PRODID:-//DocApply//Interview//EN\r\n");
        ics.append("CALSCALE:GREGORIAN\r\n");
        ics.append("METHOD:PUBLISH\r\n");
        ics.append("BEGIN:VEVENT\r\n");
        ics.append("UID:").append(uid).append("\r\n");
        ics.append("DTSTAMP:").append(ZonedDateTime.now(CET_TIMEZONE).format(ICS_DATE_FORMAT)).append("\r\n");
        ics.append("DTSTART;TZID=Europe/Berlin:").append(startTime.format(ICS_DATE_FORMAT)).append("\r\n");
        ics.append("DTEND;TZID=Europe/Berlin:").append(endTime.format(ICS_DATE_FORMAT)).append("\r\n");
        ics.append("SUMMARY:Interview: ").append(escapeIcsText(job.getTitle())).append("\r\n");

        if (slot.getLocation() != null && !slot.getLocation().isBlank()) {
            ics.append("LOCATION:").append(escapeIcsText(slot.getLocation())).append("\r\n");
        }

        boolean hasStreamLink = slot.getStreamLink() != null && !slot.getStreamLink().isBlank();

        // Build description
        StringBuilder description = new StringBuilder();
        description.append("Interview for: ").append(job.getTitle());
        if (hasStreamLink) {
            description.append("\\nVideo Link: ").append(slot.getStreamLink());
        }
        ics.append("DESCRIPTION:").append(escapeIcsText(description.toString())).append("\r\n");

        if (hasStreamLink) {
            ics.append("URL:").append(slot.getStreamLink()).append("\r\n");
        }

        ics.append("STATUS:CONFIRMED\r\n");
        ics.append("SEQUENCE:0\r\n");
        ics.append("END:VEVENT\r\n");
        ics.append("END:VCALENDAR\r\n");

        return ics.toString();
    }

    /**
     * Generates the filename for the ICS file.
     *
     * @param slot the interview slot
     * @return the filename
     */
    public String generateFileName(InterviewSlot slot) {
        ZonedDateTime startTime = slot.getStartDateTime().atZone(CET_TIMEZONE);
        String dateStr = startTime.format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        return "interview_" + dateStr + ".ics";
    }

    /**
     * Escapes special characters for ICS format.
     */
    private String escapeIcsText(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("\\", "\\\\").replace(",", "\\,").replace(";", "\\;").replace("\n", "\\n");
    }
}
